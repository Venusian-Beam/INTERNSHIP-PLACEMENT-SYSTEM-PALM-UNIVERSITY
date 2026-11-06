<?php

namespace App\Modules\Students\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Applications\Http\Controllers\StudentApplicationController;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\FileService;
use App\Modules\Students\Models\StudentProfile;
use App\Modules\Students\StageResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** FR-S1 (student's own profile) and FR-S4 (Career Services list/detail). */
class StudentController extends Controller
{
    public function updateOwn(Request $request, FileService $files): JsonResponse
    {
        $profile = $request->user()->studentProfile;
        abort_unless($profile, 403);
        $data = $request->validate([
            'full_name' => ['sometimes', 'required', 'string', 'max:120'],
            'student_number' => ['sometimes', 'required', 'string', 'max:40', Rule::unique('student_profiles', 'student_number')->ignore($profile->id)],
            'programme' => ['sometimes', 'required', 'string', 'max:120'],
            'level' => ['sometimes', 'required', 'integer', Rule::in([100, 200, 300, 400, 500, 600])],
            'phone' => ['sometimes', 'required', 'string', 'max:40', 'regex:/^[0-9+()\s-]{7,40}$/'],
            'cv_file_id' => ['sometimes', 'required', 'integer'],
        ]);
        if (isset($data['cv_file_id'])) {
            $file = $files->ownReadyFile($request->user(), (int) $data['cv_file_id'], 'cv');
            abort_if(StudentProfile::where('cv_file_id', $file->id)->where('id', '!=', $profile->id)->exists(), 422);
        }
        if (isset($data['level']) && ! $profile->on_registry) {
            $data['expected_grad_year'] = StudentProfile::deriveGradYear((int) $data['level']);
        }
        $profile->update($data);

        return response()->json(['profile' => $profile->only(['full_name', 'student_number', 'programme', 'level', 'phone', 'cv_file_id'])]);
    }

    public function index(Request $request): JsonResponse
    {
        // QA-4-01: validate filters before they reach SQL.
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'], 'programme' => ['nullable', 'string', 'max:120'],
            'level' => ['nullable', 'integer', 'between:100,600'], 'registry' => ['nullable', 'boolean'],
            'stage' => ['nullable', 'in:'.implode(',', array_keys(StageResolver::LABELS))],
        ]);
        $cycleId = Cycle::current()?->id;
        $q = StudentProfile::query()->orderBy('full_name');
        if ($term = trim((string) $request->input('search'))) {
            $like = '%'.addcslashes($term, '%_\\').'%';
            $q->where(fn ($w) => $w->where('full_name', 'ilike', $like)->orWhere('programme', 'ilike', $like)->orWhere('university_email', 'ilike', $like));
        }
        foreach (['programme', 'level'] as $f) {
            if ($request->filled($f)) {
                $q->where($f, $request->input($f));
            }
        }
        if ($request->filled('registry')) {
            $q->where('on_registry', $request->boolean('registry'));
        }
        $rows = $q->limit(300)->get()->map(fn (StudentProfile $s) => [
            'id' => $s->id, 'full_name' => $s->full_name, 'programme' => $s->programme, 'level' => $s->level,
            'registered' => (bool) $s->user_id, 'on_registry' => $s->on_registry, 'stage' => StageResolver::for($s, $cycleId),
        ]);
        if ($request->filled('stage')) {
            $rows = $rows->where('stage', $request->input('stage'))->values();
        }

        return response()->json(['students' => $rows, 'stages' => StageResolver::LABELS]);
    }

    public function show(StudentProfile $student): JsonResponse
    {
        $apps = $student->applications()->with(['cycle:id,name', 'choices.organisation', 'matchedOrganisation', 'placements.organisation', 'placements.letter'])->orderByDesc('cycle_id')->get();

        return response()->json(['student' => [
            'id' => $student->id, 'full_name' => $student->full_name, 'email' => $student->university_email,
            'student_number' => $student->student_number, 'programme' => $student->programme, 'level' => $student->level,
            'phone' => $student->phone, 'on_registry' => $student->on_registry, 'registered' => (bool) $student->user_id,
            'expected_grad_year' => $student->expected_grad_year, 'cv_file_id' => $student->cv_file_id,
            'stage' => StageResolver::for($student),
            'applications' => $apps->map(fn ($a) => StudentApplicationController::present($a) + ['cycle' => $a->cycle?->name]),
        ]]);
    }
}
