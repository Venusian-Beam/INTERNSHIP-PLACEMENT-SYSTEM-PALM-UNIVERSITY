<?php

namespace App\Modules\Files\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Files\FileService;
use App\Modules\Files\Models\StoredFile;
use App\Modules\Letters\Models\Letter;
use App\Modules\Placements\Models\Placement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FileController extends Controller
{
    public function __construct(private readonly FileService $files) {}

    public function presign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['cv', 'acceptance', 'report', 'evaluation', 'signature', 'registry_csv', 'template_source'])],
            'mime' => ['required', 'string', 'max:100'],
            'size' => ['required', 'integer', 'min:1'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        return response()->json($this->files->presignUpload($request->user(), $data['kind'], $data['mime'], (int) $data['size'], $data['name']), 201);
    }

    public function confirm(Request $request, StoredFile $file): JsonResponse
    {
        $file = $this->files->confirm($request->user(), $file);

        return response()->json(['file' => ['id' => $file->id, 'name' => $file->original_name, 'size' => $file->size_bytes, 'kind' => $file->kind]]);
    }

    /** Download link, after an ownership/role check (FR-X3). */
    public function download(Request $request, StoredFile $file): JsonResponse
    {
        $user = $request->user();
        abort_unless($file->status === 'ready' && ! $file->deleted_at && $this->canView($user, $file), 404);

        return response()->json(['url' => $this->files->downloadUrl($file, $user, $request->boolean('inline'))]);
    }

    private function canView($user, StoredFile $file): bool
    {
        if ($file->kind === 'signature') {
            return false;
        }
        if ($user->isCareerServices()) {
            return true; // Career Services may view any placement document (audited in FileService)
        }
        if ($user->isPresident() || ! $user->isStudent()) {
            return false;
        }
        $profile = $user->studentProfile;
        if (! $profile) {
            return false;
        }

        return match ($file->kind) {
            'cv' => $profile->cv_file_id === $file->id,
            'acceptance' => Placement::where('student_profile_id', $profile->id)->where('acceptance_file_id', $file->id)->exists(),
            'report' => Placement::where('student_profile_id', $profile->id)->where('report_file_id', $file->id)->exists(),
            // D8: a student may download the letter that was SENT on their behalf.
            'letter_pdf' => Letter::where('pdf_file_id', $file->id)->where('status', 'sent')
                ->whereHas('placements', fn ($q) => $q->where('student_profile_id', $profile->id))->exists(),
            default => false,
        };
    }
}
