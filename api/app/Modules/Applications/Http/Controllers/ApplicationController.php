<?php

namespace App\Modules\Applications\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Notifications\StudentMail;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use App\Modules\Students\Models\StudentProfile;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Career Services side: FR-P3–P7, BR2, D28 (matching is always a human decision). */
class ApplicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cycleId = $request->integer('cycle_id') ?: Cycle::current()?->id;
        $q = Application::with(['student:id,full_name,programme,level', 'matchedOrganisation:id,name'])
            ->where('cycle_id', $cycleId)->where('status', '!=', 'draft')->orderBy('submitted_at');
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($term = trim((string) $request->input('search'))) {
            $q->whereHas('student', fn ($s) => $s->where('full_name', 'ilike', '%'.addcslashes($term, '%_\\').'%'));
        }

        return response()->json(['applications' => $q->limit(500)->get()->map(fn ($a) => [
            'id' => $a->id, 'status' => $a->status, 'submitted_at' => $a->submitted_at?->toIso8601String(),
            'student' => $a->student?->only(['id', 'full_name', 'programme', 'level']), 'matched' => $a->matchedOrganisation?->name,
        ])]);
    }

    public function show(Application $application): JsonResponse
    {
        $application->load(['student', 'choices.organisation', 'matchedOrganisation', 'placements.organisation']);
        $s = $application->student;

        return response()->json(['application' => StudentApplicationController::present($application) + [
            'interview_notes' => $application->interview_notes,
            'student' => ['id' => $s->id, 'full_name' => $s->full_name, 'programme' => $s->programme, 'level' => $s->level,
                'email' => $s->university_email, 'phone' => $s->phone, 'cv_file_id' => $s->cv_file_id],
        ]]);
    }

    /** UC5: record the interview outcome. Pass creates the placement (letter pending) for the matched organisation. */
    public function recordOutcome(Request $request, Application $application): JsonResponse
    {
        $data = $request->validate([
            'interview_date' => ['required', 'date', 'before_or_equal:today'],
            'result' => ['required', Rule::in(['pass', 'not_recommended'])],
            'matched_organisation_id' => ['required_if:result,pass', 'nullable', 'integer'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        DB::transaction(function () use ($application, $data, $request) {
            // QA-2-02: lock the row so a double-submitted outcome can't be recorded twice (or create two placements).
            $locked = Application::whereKey($application->id)->lockForUpdate()->first();
            if ($locked->status !== 'submitted') {
                throw ValidationException::withMessages(['result' => 'An outcome has already been recorded for this application.']);
            }
            $pass = $data['result'] === 'pass';
            $org = null;
            if ($pass) {
                $org = Organisation::whereKey($data['matched_organisation_id'])->where('status', 'active')->first();
                if (! $org) {
                    throw ValidationException::withMessages(['matched_organisation_id' => 'Match an active organisation (not one still waiting for a check).']);
                }
            }
            $application->update([
                'status' => $pass ? 'passed' : 'not_recommended', 'interview_date' => $data['interview_date'],
                'interview_notes' => $data['notes'] ?? null, 'matched_organisation_id' => $org?->id,
                'outcome_recorded_by' => $request->user()->id, 'outcome_recorded_at' => now(),
            ]);
            if ($pass) {
                Placement::create(['application_id' => $application->id, 'student_profile_id' => $application->student_profile_id,
                    'organisation_id' => $org->id, 'cycle_id' => $application->cycle_id, 'status' => 'letter_pending']);
            }
        });
        Audit::log('application.outcome', $application, ['result' => $data['result'], 'organisation' => $application->matched_organisation_id]);

        $application->refresh();
        StudentMail::send($application->student, 'interview_outcome', 'Your interview outcome', $application->status === 'passed'
            ? ['Good news: you passed your Career Services interview.', "You have been matched to **{$application->matchedOrganisation->name}**. Career Services will send your introductory letter to them."]
            : ['Thank you for attending your Career Services interview.', 'You have not been recommended for placement this cycle. You can apply again next cycle.']);

        return response()->json(['application' => StudentApplicationController::present($application->load('choices.organisation', 'matchedOrganisation'))]);
    }

    /** FR-P3: let one student apply after the window closed (recorded who allowed it). */
    public function admitLate(Request $request): JsonResponse
    {
        $data = $request->validate(['student_profile_id' => ['required', 'integer', 'exists:student_profiles,id']]);
        $cycle = Cycle::current();
        if (! $cycle || $cycle->isPastCutoff()) {
            throw ValidationException::withMessages(['student_profile_id' => 'The cycle is past its cut-off date.']);
        }
        $student = StudentProfile::findOrFail($data['student_profile_id']);
        if (! $student->user_id) {
            throw ValidationException::withMessages(['student_profile_id' => 'This student has not registered yet.']);
        }
        $app = Application::firstOrCreate(['student_profile_id' => $student->id, 'cycle_id' => $cycle->id], ['status' => 'draft']);
        if ($app->status !== 'draft') {
            throw ValidationException::withMessages(['student_profile_id' => 'This student has already applied this cycle.']);
        }
        $app->update(['late_admitted_by' => $request->user()->id]);
        Audit::log('application.late_admitted', $app);

        return response()->json(['message' => "{$student->full_name} can now submit an application."], 201);
    }
}
