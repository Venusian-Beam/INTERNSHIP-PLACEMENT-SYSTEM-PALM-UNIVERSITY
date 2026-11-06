<?php

namespace App\Modules\Applications\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Http\Controllers\CycleController;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Students\Models\StudentProfile;
use App\Modules\Students\StageResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Student side of applications: FR-P1, FR-P2, BR1 (always scoped to the signed-in student's own profile). */
class StudentApplicationController extends Controller
{
    /** S1/S4 data: the current cycle, the student's application in it, and their overall stage. */
    public function show(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $cycle = Cycle::current();
        $app = $cycle ? Application::with(['choices.organisation', 'matchedOrganisation', 'placements.organisation', 'placements.letter'])
            ->where('student_profile_id', $profile->id)->where('cycle_id', $cycle->id)->first() : null;

        return response()->json([
            'cycle' => $cycle ? CycleController::present($cycle) : null,
            'application' => $app ? self::present($app) : null,
            'stage' => StageResolver::for($profile, $cycle?->id),
            'profile_complete' => self::profileGaps($profile) === [],
            'profile_gaps' => self::profileGaps($profile),
        ]);
    }

    /** Autosaved draft (UI-D5). Allowed while the window is open, or after staff admitted a late application. */
    public function saveDraft(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $data = $request->validate([
            'motivation' => ['nullable', 'string', 'max:1200'],
            'choices' => ['present', 'array', 'max:3'],
            'choices.*' => ['integer', 'distinct'],
        ]);
        $cycle = $this->openCycleFor($profile);

        $app = DB::transaction(function () use ($profile, $cycle, $data) {
            $app = Application::firstOrCreate(['student_profile_id' => $profile->id, 'cycle_id' => $cycle->id], ['status' => 'draft']);
            if ($app->status !== 'draft') {
                throw ValidationException::withMessages(['application' => 'Your application has already been submitted.']);
            }
            $ids = array_values($data['choices']);
            $this->assertChoosable($ids, $profile);
            $app->update(['motivation' => $data['motivation'] ?? null]);
            $app->choices()->delete();
            foreach ($ids as $i => $orgId) {
                $app->choices()->create(['rank' => $i + 1, 'organisation_id' => $orgId]);
            }

            return $app;
        });

        return response()->json(['application' => self::present($app->load('choices.organisation'))]);
    }

    public function submit(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $cycle = $this->openCycleFor($profile);

        // QA-2-03: check and submit atomically.
        return DB::transaction(function () use ($profile, $cycle) {
            $app = Application::with('choices.organisation')->where('student_profile_id', $profile->id)->where('cycle_id', $cycle->id)->lockForUpdate()->first();

            $errors = [];
            if (! $app || $app->status !== 'draft') {
                $errors['application'] = $app ? 'Your application has already been submitted.' : 'Start your application first.';
            } else {
                if (self::profileGaps($profile)) {
                    $errors['profile'] = 'Complete your details: '.implode(', ', self::profileGaps($profile)).'.';
                }
                if (! $profile->cv_file_id) {
                    $errors['cv'] = 'Upload your CV (PDF).';
                }
                if (trim((string) $app->motivation) === '') {
                    $errors['motivation'] = 'Write your motivation statement.';
                }
                if ($app->choices->isEmpty()) {
                    $errors['choices'] = 'Choose at least one organisation.';
                }
                $this->assertChoosable($app->choices->pluck('organisation_id')->all(), $profile);
            }
            if ($errors) {
                throw ValidationException::withMessages($errors);
            }

            $app->update(['status' => 'submitted', 'submitted_at' => now()]);

            return response()->json(['application' => self::present($app->fresh('choices.organisation'))]);
        });
    }

    private function profile(Request $request): StudentProfile
    {
        $p = $request->user()->studentProfile;
        abort_unless($p, 403);

        return $p;
    }

    /** BR1: window open, or a late admission recorded by staff (before the letter cut-off). */
    private function openCycleFor(StudentProfile $profile): Cycle
    {
        $cycle = Cycle::current();
        if (! $cycle) {
            throw ValidationException::withMessages(['cycle' => 'There is no application cycle yet.']);
        }
        $late = Application::where('student_profile_id', $profile->id)->where('cycle_id', $cycle->id)->whereNotNull('late_admitted_by')->exists();
        if (! $cycle->isOpenForApplications() && ! ($late && ! $cycle->isPastCutoff())) {
            throw ValidationException::withMessages(['cycle' => 'Applications are closed for '.$cycle->name.'. Contact Career Services.']);
        }

        return $cycle;
    }

    /** Choices must be Active organisations, or the student's own proposals still pending a check (BR3). */
    private function assertChoosable(array $orgIds, StudentProfile $profile): void
    {
        if (! $orgIds) {
            return;
        }
        $ok = Organisation::whereIn('id', $orgIds)
            ->where(fn ($q) => $q->where('status', 'active')
                ->orWhere(fn ($w) => $w->where('status', 'pending_check')->where('proposed_by_student_id', $profile->id)))
            ->count();
        if ($ok !== count(array_unique($orgIds))) {
            throw ValidationException::withMessages(['choices' => 'One of your choices is no longer available. Choose another organisation.']);
        }
    }

    public static function profileGaps(StudentProfile $p): array
    {
        $gaps = [];
        foreach (['full_name' => 'full name', 'student_number' => 'student ID', 'programme' => 'programme', 'level' => 'level', 'phone' => 'phone'] as $f => $label) {
            if (blank($p->{$f})) {
                $gaps[] = $label;
            }
        }

        return $gaps;
    }

    public static function present(Application $a): array
    {
        return [
            'id' => $a->id, 'cycle_id' => $a->cycle_id, 'status' => $a->status, 'motivation' => $a->motivation,
            'submitted_at' => $a->submitted_at?->toIso8601String(), 'late_admitted' => (bool) $a->late_admitted_by,
            'interview_date' => $a->interview_date?->toDateString(),
            'matched_organisation' => $a->matchedOrganisation?->only(['id', 'name']),
            'choices' => $a->choices->map(fn ($c) => [
                'rank' => $c->rank, 'organisation_id' => $c->organisation_id, 'name' => $c->organisation?->name,
                'status' => $c->organisation?->status, 'rejection_reason' => $c->organisation?->status === 'rejected' ? $c->organisation->rejection_reason : null,
            ])->values(),
            'placements' => $a->relationLoaded('placements') ? $a->placements->sortByDesc('id')->values()->map(fn ($p) => [
                'id' => $p->id, 'status' => $p->status, 'organisation' => $p->organisation?->name,
                'letter' => $p->letter && $p->letter->status === 'sent' ? ['reference_no' => $p->letter->reference_no, 'pdf_file_id' => $p->letter->pdf_file_id, 'sent_at' => $p->letter->sent_at?->toIso8601String()] : null,
                'acceptance_file_id' => $p->acceptance_file_id, 'report_file_id' => $p->report_file_id,
            ]) : [],
        ];
    }
}
