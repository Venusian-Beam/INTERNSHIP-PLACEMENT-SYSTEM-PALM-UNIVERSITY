<?php

namespace App\Modules\Organisations\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Applications\Models\ApplicationChoice;
use App\Modules\Notifications\StudentMail;
use App\Modules\Organisations\Models\Organisation;
use App\Support\Audit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** FR-O1–O5, BR3. */
class OrganisationController extends Controller
{
    private const FIELDS = ['name', 'address', 'email', 'contact_person', 'contact_title', 'phone', 'sector'];

    /** Students see Active organisations plus their own proposals; Career Services sees everything. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $q = Organisation::query()->orderBy('name');
        if ($user->isStudent()) {
            $pid = $user->studentProfile?->id;
            $q->where(fn (Builder $w) => $w->where('status', 'active')->orWhere('proposed_by_student_id', $pid));
        } elseif ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($term = trim((string) $request->input('search'))) {
            $q->where('name', 'ilike', '%'.addcslashes($term, '%_\\').'%');
        }

        return response()->json(['organisations' => $q->limit(200)->get()->map(fn ($o) => $this->present($o, $user->isStudent()))]);
    }

    /** FR-O5: likely duplicates by name similarity (pg_trgm). */
    public function similar(Request $request): JsonResponse
    {
        $name = trim((string) $request->validate(['name' => ['required', 'string', 'max:190']])['name']);

        $user = $request->user();

        return response()->json(['similar' => $this->similarTo($name, null, $user->isStudent() ? $user->studentProfile?->id ?? 0 : null)
            ->map(fn ($o) => ['id' => $o->id, 'name' => $o->name, 'status' => $o->status])]);
    }

    /** FR-O2: staff add organisations directly as Active (email required: letters are emailed). */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules(requireEmail: true));
        $org = Organisation::create($data + ['status' => 'active', 'checked_by' => $request->user()->id, 'checked_at' => now()]);
        Audit::log('organisation.created', $org);

        return response()->json(['organisation' => $this->present($org)], 201);
    }

    public function update(Request $request, Organisation $organisation): JsonResponse
    {
        $data = $request->validate($this->rules(requireEmail: $organisation->status === 'active'));
        $organisation->update($data);

        return response()->json(['organisation' => $this->present($organisation)]);
    }

    /** FR-O3: student proposes an organisation that isn't listed. */
    public function propose(Request $request): JsonResponse
    {
        $profile = $request->user()->studentProfile;
        abort_unless($profile, 403);
        $data = $request->validate($this->rules(requireEmail: false));
        if (Organisation::where('proposed_by_student_id', $profile->id)->where('status', 'pending_check')->count() >= 3) {
            throw ValidationException::withMessages(['name' => 'You already have 3 organisations waiting for a check.']);
        }
        $org = Organisation::create($data + ['status' => 'pending_check', 'proposed_by_student_id' => $profile->id]);

        return response()->json(['organisation' => $this->present($org, true), 'similar' => $this->similarTo($org->name, $org->id, $profile->id)->map(fn ($o) => ['id' => $o->id, 'name' => $o->name])], 201);
    }

    public function queue(): JsonResponse
    {
        $items = Organisation::with('proposer:id,full_name')->where('status', 'pending_check')->orderBy('created_at')->get()
            ->map(fn ($o) => $this->present($o) + [
                'proposed_by' => $o->proposer?->full_name,
                'similar' => $this->similarTo($o->name, $o->id)->where('status', 'active')->values()->map(fn ($s) => ['id' => $s->id, 'name' => $s->name]),
            ]);

        return response()->json(['queue' => $items]);
    }

    public function approve(Request $request, Organisation $organisation): JsonResponse
    {
        $this->assertPending($organisation);
        if (! $organisation->email) {
            throw ValidationException::withMessages(['email' => 'Add the organisation\'s email before approving (letters are emailed).']);
        }
        $organisation->update(['status' => 'active', 'checked_by' => $request->user()->id, 'checked_at' => now(), 'rejection_reason' => null]);
        Audit::log('organisation.approved', $organisation);
        $this->notifyProposer($organisation, 'Organisation approved', ["Career Services checked and approved **{$organisation->name}**. It is now one of your choices."]);

        return response()->json(['organisation' => $this->present($organisation)]);
    }

    public function reject(Request $request, Organisation $organisation): JsonResponse
    {
        $this->assertPending($organisation);
        $reason = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']])['reason'];
        $organisation->update(['status' => 'rejected', 'rejection_reason' => $reason, 'checked_by' => $request->user()->id, 'checked_at' => now()]);
        Audit::log('organisation.rejected', $organisation, ['reason' => $reason]);
        $this->notifyProposer($organisation, 'Organisation not approved', [
            "Career Services could not approve **{$organisation->name}**.", "Reason: {$reason}",
            'Your other choices still stand, and you can propose a different organisation.',
        ]);

        return response()->json(['organisation' => $this->present($organisation)]);
    }

    /** Merge a duplicate proposal into an existing Active organisation; the student's choice moves across. */
    public function merge(Request $request, Organisation $organisation): JsonResponse
    {
        $this->assertPending($organisation);
        $intoId = (int) $request->validate(['into_id' => ['required', 'integer']])['into_id'];
        $into = Organisation::where('id', $intoId)->where('status', 'active')->first();
        if (! $into || $into->id === $organisation->id) {
            throw ValidationException::withMessages(['into_id' => 'Choose an active organisation to merge into.']);
        }
        DB::transaction(function () use ($organisation, $into, $request) {
            foreach (ApplicationChoice::where('organisation_id', $organisation->id)->get() as $choice) {
                $dupe = ApplicationChoice::where('application_id', $choice->application_id)->where('organisation_id', $into->id)->exists();
                $dupe ? $choice->delete() : $choice->update(['organisation_id' => $into->id]);
            }
            $organisation->update(['status' => 'merged', 'merged_into_id' => $into->id, 'checked_by' => $request->user()->id, 'checked_at' => now()]);
        });
        Audit::log('organisation.merged', $organisation, ['into' => $into->id]);
        $this->notifyProposer($organisation, 'Organisation matched to our list', ["**{$organisation->name}** is already on our list as **{$into->name}**, so your choice now points there."]);

        return response()->json(['organisation' => $this->present($organisation->fresh())]);
    }

    /**
     * SEC-04: when $studentProfileId is given (a student is asking), only Active organisations and that student's own
     * proposals are visible; other students' pending proposals are never revealed.
     */
    private function similarTo(string $name, ?int $exceptId = null, ?int $studentProfileId = null)
    {
        return Organisation::query()
            ->when($studentProfileId === null, fn ($q) => $q->whereIn('status', ['active', 'pending_check']))
            ->when($studentProfileId !== null, fn ($q) => $q->where(fn ($w) => $w->where('status', 'active')
                ->orWhere(fn ($own) => $own->where('status', 'pending_check')->where('proposed_by_student_id', $studentProfileId))))
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->whereRaw('similarity(lower(name), lower(?)) > 0.3', [$name])
            ->orderByRaw('similarity(lower(name), lower(?)) desc', [$name])->limit(5)->get();
    }

    private function assertPending(Organisation $o): void
    {
        if ($o->status !== 'pending_check') {
            throw ValidationException::withMessages(['status' => 'This organisation has already been checked.']);
        }
    }

    private function notifyProposer(Organisation $o, string $subject, array $lines): void
    {
        if ($o->proposer) {
            StudentMail::send($o->proposer, 'org_check', $subject, $lines);
        }
    }

    private function rules(bool $requireEmail): array
    {
        return [
            'name' => ['required', 'string', 'max:190'],
            'address' => ['nullable', 'string', 'max:255'],
            'email' => [$requireEmail ? 'required' : 'nullable', 'email:rfc', 'max:190'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'contact_title' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'sector' => ['nullable', 'string', 'max:80'],
        ];
    }

    private function present(Organisation $o, bool $forStudent = false): array
    {
        $base = $o->only(['id', 'name', 'status', 'sector', 'address']) + ['rejection_reason' => $o->status === 'rejected' ? $o->rejection_reason : null];

        return $forStudent ? $base : $base + $o->only(['email', 'contact_person', 'contact_title', 'phone', 'merged_into_id', 'checked_at']);
    }
}
