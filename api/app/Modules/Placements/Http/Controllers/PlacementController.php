<?php

namespace App\Modules\Placements\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\FileService;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** FR-PL1–PL6, BR6–BR8: company replies, acceptance confirmation, re-match, completion. */
class PlacementController extends Controller
{
    public function __construct(private readonly FileService $files) {}

    // ---------- Student (own placements only) ----------

    /** S5: the student records the company's reply (BR7: an acceptance needs the letter and staff confirmation). */
    public function studentReply(Request $request, Placement $placement): JsonResponse
    {
        $this->assertOwn($request, $placement);

        return $this->recordReply($request, $placement, byStaff: false);
    }

    public function studentReport(Request $request, Placement $placement): JsonResponse
    {
        $this->assertOwn($request, $placement);
        if ($placement->status !== 'accepted') {
            throw ValidationException::withMessages(['file_id' => 'You can upload your report once your placement is accepted.']);
        }
        $file = $this->files->ownReadyFile($request->user(), (int) $request->validate(['file_id' => ['required', 'integer']])['file_id'], 'report');
        $placement->update(['report_file_id' => $file->id]);

        return response()->json(['placement' => $this->present($placement->fresh())]);
    }

    // ---------- Career Services ----------

    public function index(Request $request): JsonResponse
    {
        $cycleId = $request->integer('cycle_id') ?: Cycle::current()?->id;
        $rows = Placement::with(['student:id,full_name,programme,level', 'organisation:id,name', 'letter:id,reference_no,sent_at'])
            ->where('cycle_id', $cycleId)->orderByDesc('updated_at')->limit(500)->get();
        $needsRematch = Application::with('student:id,full_name,programme,level')->where('cycle_id', $cycleId)->where('status', 'passed')
            ->whereDoesntHave('placements', fn ($q) => $q->where('status', '!=', 'declined'))->get()
            ->map(fn ($a) => ['application_id' => $a->id, 'student' => $a->student?->only(['id', 'full_name', 'programme', 'level']),
                'declined' => $a->placements()->with('organisation:id,name')->get()->pluck('organisation.name')]);

        return response()->json(['placements' => $rows->map(fn ($p) => $this->present($p)), 'needs_rematch' => $needsRematch]);
    }

    /** F10: the company replied to Career Services; staff record it (an acceptance recorded by staff is confirmed at once). */
    public function staffReply(Request $request, Placement $placement): JsonResponse
    {
        return $this->recordReply($request, $placement, byStaff: true);
    }

    public function confirm(Request $request, Placement $placement): JsonResponse
    {
        $updated = Placement::whereKey($placement->id)->where('status', 'acceptance_submitted')->whereNotNull('acceptance_file_id')
            ->update(['status' => 'accepted', 'acceptance_confirmed_by' => $request->user()->id, 'acceptance_confirmed_at' => now()]);
        if (! $updated) {
            throw ValidationException::withMessages(['status' => 'There is no acceptance waiting for confirmation.']);
        }
        Audit::log('placement.acceptance_confirmed', $placement);

        return response()->json(['placement' => $this->present($placement->fresh())]);
    }

    /** Proposed safety step: the uploaded file isn't a valid acceptance letter; return it to the student. */
    public function rejectAcceptance(Request $request, Placement $placement): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $updated = Placement::whereKey($placement->id)->where('status', 'acceptance_submitted')
            ->update(['status' => 'letter_sent', 'acceptance_file_id' => null, 'reply_recorded_at' => null, 'reply_recorded_by' => null]);
        if (! $updated) {
            throw ValidationException::withMessages(['status' => 'There is no acceptance waiting for confirmation.']);
        }
        Audit::log('placement.acceptance_returned', $placement, ['reason' => $request->input('reason')]);

        return response()->json(['placement' => $this->present($placement->fresh())]);
    }

    /** BR6: after a decline, staff match the student to another active organisation (unlimited, until the cut-off). */
    public function rematch(Request $request): JsonResponse
    {
        $data = $request->validate(['application_id' => ['required', 'integer'], 'organisation_id' => ['required', 'integer']]);
        $placement = DB::transaction(function () use ($data) {
            $app = Application::whereKey($data['application_id'])->lockForUpdate()->firstOrFail();
            if ($app->status !== 'passed') {
                throw ValidationException::withMessages(['application_id' => 'Only a passed application can be re-matched.']);
            }
            if ($app->placements()->where('status', '!=', 'declined')->exists()) {
                throw ValidationException::withMessages(['application_id' => 'This student already has an open placement.']);
            }
            if ($app->cycle->isPastCutoff()) {
                throw ValidationException::withMessages(['application_id' => 'This cycle is past its letter cut-off.']);
            }
            $org = Organisation::whereKey($data['organisation_id'])->where('status', 'active')->first()
                ?? throw ValidationException::withMessages(['organisation_id' => 'Choose an active organisation.']);
            $app->update(['matched_organisation_id' => $org->id]);

            return Placement::create(['application_id' => $app->id, 'student_profile_id' => $app->student_profile_id, 'organisation_id' => $org->id,
                'cycle_id' => $app->cycle_id, 'status' => 'letter_pending']);
        });
        Audit::log('placement.rematched', $placement, ['organisation' => $placement->organisation_id]);

        return response()->json(['placement' => $this->present($placement)], 201);
    }

    /** F17/D21: the company emails the evaluation form to Career Services, who upload it. */
    public function evaluation(Request $request, Placement $placement): JsonResponse
    {
        if (! in_array($placement->status, ['accepted'], true)) {
            throw ValidationException::withMessages(['file_id' => 'The placement must be accepted first.']);
        }
        $file = $this->files->ownReadyFile($request->user(), (int) $request->validate(['file_id' => ['required', 'integer']])['file_id'], 'evaluation');
        $placement->update(['evaluation_file_id' => $file->id]);

        return response()->json(['placement' => $this->present($placement->fresh())]);
    }

    /** BR8: Head marks Completed once the report and the evaluation form are both in. */
    public function complete(Request $request, Placement $placement): JsonResponse
    {
        $updated = Placement::whereKey($placement->id)->where('status', 'accepted')->whereNotNull('report_file_id')->whereNotNull('evaluation_file_id')
            ->update(['status' => 'completed', 'completed_by' => $request->user()->id, 'completed_at' => now()]);
        if (! $updated) {
            throw ValidationException::withMessages(['status' => 'Both the student\'s report and the evaluation form are needed first.']);
        }
        Audit::log('placement.completed', $placement);

        return response()->json(['placement' => $this->present($placement->fresh())]);
    }

    // ---------- helpers ----------

    private function recordReply(Request $request, Placement $placement, bool $byStaff): JsonResponse
    {
        $data = $request->validate([
            'result' => ['required', Rule::in(['accepted', 'declined'])],
            'acceptance_file_id' => ['required_if:result,accepted', 'nullable', 'integer'],
        ]);

        $placement = DB::transaction(function () use ($request, $placement, $data, $byStaff) {
            $p = Placement::whereKey($placement->id)->lockForUpdate()->first();
            if ($p->status !== 'letter_sent') {
                throw ValidationException::withMessages(['result' => 'A reply can only be recorded after the letter is sent, and only once.']);
            }
            $fields = ['reply_recorded_by' => $request->user()->id, 'reply_recorded_at' => now()];
            if ($data['result'] === 'accepted') {
                $file = $this->files->ownReadyFile($request->user(), (int) $data['acceptance_file_id'], 'acceptance');
                $fields += $byStaff
                    ? ['status' => 'accepted', 'acceptance_file_id' => $file->id, 'acceptance_confirmed_by' => $request->user()->id, 'acceptance_confirmed_at' => now()]
                    : ['status' => 'acceptance_submitted', 'acceptance_file_id' => $file->id];
            } else {
                $fields['status'] = 'declined';
            }
            $p->update($fields);

            return $p;
        });
        Audit::log('placement.reply_recorded', $placement, ['result' => $data['result'], 'by' => $byStaff ? 'staff' : 'student']);

        return response()->json(['placement' => $this->present($placement->fresh())]);
    }

    private function assertOwn(Request $request, Placement $placement): void
    {
        abort_unless($placement->student_profile_id === $request->user()->studentProfile?->id, 404);
    }

    private function present(Placement $p): array
    {
        $p->loadMissing(['student:id,full_name,programme,level', 'organisation:id,name', 'letter:id,reference_no,sent_at']);

        return [
            'id' => $p->id, 'status' => $p->status, 'application_id' => $p->application_id,
            'student' => $p->student?->only(['id', 'full_name', 'programme', 'level']), 'organisation' => $p->organisation?->only(['id', 'name']),
            'letter' => $p->letter ? ['reference_no' => $p->letter->reference_no, 'sent_at' => $p->letter->sent_at?->toIso8601String()] : null,
            'acceptance_file_id' => $p->acceptance_file_id, 'report_file_id' => $p->report_file_id, 'evaluation_file_id' => $p->evaluation_file_id,
            'reply_recorded_at' => $p->reply_recorded_at?->toIso8601String(), 'completed_at' => $p->completed_at?->toIso8601String(),
        ];
    }
}
