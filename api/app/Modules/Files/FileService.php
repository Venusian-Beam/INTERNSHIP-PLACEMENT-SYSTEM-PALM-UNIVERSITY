<?php

namespace App\Modules\Files;

use App\Models\User;
use App\Modules\Files\Models\StoredFile;
use App\Support\Audit;
use Aws\S3\PostObjectV4;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * AD6 + Vercel's 4.5 MB body limit: files go browser → storage directly through short-lived presigned URLs.
 * The API only issues URLs, records metadata, and verifies the object after upload (size + magic bytes).
 */
class FileService
{
    /** Which roles may upload which kinds (NFR-S9). */
    private const UPLOADERS = [
        'cv' => ['student'],
        'acceptance' => ['student', 'staff', 'head'],
        'report' => ['student'],
        'evaluation' => ['staff', 'head'],
        'signature' => ['head'],
        'registry_csv' => ['head'],
        'template_source' => ['head'],
    ];

    public const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    /** Accepted MIME types per kind (browsers label CSV inconsistently, so CSV is verified by parsing instead). */
    private const MIMES = [
        'cv' => ['application/pdf'], 'acceptance' => ['application/pdf'], 'report' => ['application/pdf'],
        'evaluation' => ['application/pdf'], 'signature' => ['image/png'],
        'registry_csv' => ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'],
        'template_source' => [self::DOCX, 'application/pdf'],
    ];

    /** A .docx is a ZIP archive, so it starts with the ZIP local-file signature. */
    private const MAGIC = ['application/pdf' => '%PDF-', 'image/png' => "\x89PNG\r\n\x1a\n", self::DOCX => "PK\x03\x04"];

    public function disk()
    {
        return Storage::disk('s3');
    }

    public function presignUpload(User $user, string $kind, string $mime, int $size, string $name): array
    {
        if (! in_array($user->role, self::UPLOADERS[$kind] ?? [], true)) {
            abort(403, 'You cannot upload this kind of file.');
        }
        if (! in_array($mime, self::MIMES[$kind], true)) {
            throw ValidationException::withMessages(['mime' => match ($kind) {
                'signature' => 'Upload a PNG image.',
                'registry_csv' => 'Upload a CSV file.',
                'template_source' => 'Upload a Word (.docx) or PDF file. For an older .doc file, open it in Word and Save As .docx.',
                default => 'Upload a PDF file.',
            }]);
        }
        $max = $kind === 'registry_csv' ? 10 * 1024 * 1024 : config('placement.uploads.max_bytes');
        if ($size < 1 || $size > $max) {
            throw ValidationException::withMessages(['size' => 'The file must be smaller than '.round($max / 1048576).' MB.']);
        }

        $this->sweepStalePending($user);

        $ext = ['application/pdf' => 'pdf', 'image/png' => 'png', self::DOCX => 'docx'][$mime] ?? 'csv';
        $file = StoredFile::create([
            'kind' => $kind, 'storage_key' => $kind.'/'.now()->format('Y/m').'/'.Str::uuid().'.'.$ext,
            'original_name' => mb_substr(preg_replace('/[^\w.\- ()]+/u', '_', $name) ?: "file.{$ext}", 0, 200),
            'mime' => $mime, 'size_bytes' => $size, 'status' => 'pending', 'uploaded_by' => $user->id,
        ]);

        // QA-2-01: a presigned PUT cannot bind the size (S3 never signs Content-Length on presigned URLs), so use a
        // presigned POST policy: storage itself rejects any upload outside 1..$size bytes, any other key, any other type.
        $c = config('filesystems.disks.s3');
        $post = new PostObjectV4($this->s3Client(), $c['bucket'],
            ['key' => $file->storage_key, 'Content-Type' => $mime],
            [['bucket' => $c['bucket']], ['eq', '$key', $file->storage_key], ['eq', '$Content-Type', $mime], ['content-length-range', 1, $size]],
            '+'.config('placement.uploads.presign_minutes').' minutes');

        return ['file_id' => $file->id, 'url' => $post->getFormAttributes()['action'], 'fields' => $post->getFormInputs()];
    }

    /** Uploads never confirmed within an hour are abandoned: remove the object and the row. */
    private function sweepStalePending(User $user): void
    {
        StoredFile::where('uploaded_by', $user->id)->where('status', 'pending')->where('created_at', '<', now()->subHour())
            ->limit(50)->get()->each(function (StoredFile $f) {
                $this->disk()->delete($f->storage_key);
                $f->delete();
            });
    }

    private function s3Client(): S3Client
    {
        $c = config('filesystems.disks.s3');

        return new S3Client(array_filter([
            'version' => 'latest', 'region' => $c['region'], 'endpoint' => $c['endpoint'] ?: null,
            'use_path_style_endpoint' => (bool) $c['use_path_style_endpoint'],
            'credentials' => ['key' => $c['key'], 'secret' => $c['secret']],
        ], fn ($v) => $v !== null));
    }

    /** After the browser's PUT: check the object really exists, has an allowed size, and starts with the right bytes. */
    public function confirm(User $user, StoredFile $file): StoredFile
    {
        if ($file->uploaded_by !== $user->id || $file->status !== 'pending') {
            abort(404);
        }
        $disk = $this->disk();
        if (! $disk->exists($file->storage_key)) {
            throw ValidationException::withMessages(['file' => 'The upload did not finish. Try again.']);
        }
        $size = $disk->size($file->storage_key);
        $max = $file->kind === 'registry_csv' ? 10 * 1024 * 1024 : config('placement.uploads.max_bytes');
        $magic = self::MAGIC[$file->mime] ?? null;
        $head = '';
        if ($magic) {
            $stream = $disk->readStream($file->storage_key);
            $head = (string) fread($stream, strlen($magic));
            fclose($stream);
        }
        if ($size > $max || ($magic && $head !== $magic)) {
            $disk->delete($file->storage_key);
            $file->delete();
            throw ValidationException::withMessages(['file' => $magic ? 'That file is not a valid '.strtoupper(pathinfo($file->storage_key, PATHINFO_EXTENSION)).'.' : 'That file is too large.']);
        }
        $file->update(['status' => 'ready', 'size_bytes' => $size]);

        return $file;
    }

    /** A ready file the user uploaded, of the expected kind, not yet attached elsewhere (callers check attachment). */
    public function ownReadyFile(User $user, int $fileId, string $kind): StoredFile
    {
        $file = StoredFile::where('id', $fileId)->where('uploaded_by', $user->id)->where('kind', $kind)
            ->where('status', 'ready')->whereNull('deleted_at')->first();
        if (! $file) {
            throw ValidationException::withMessages(['file_id' => 'Upload the file first.']);
        }

        return $file;
    }

    /** Short-lived download link. Call only after an authorisation check. Staff downloads of student documents are audited. */
    public function downloadUrl(StoredFile $file, ?User $viewer = null, bool $inline = false): string
    {
        if ($file->kind === 'signature') {
            abort(404); // NFR-S7: never sent to any browser
        }
        if ($viewer && $viewer->isCareerServices() && in_array($file->kind, ['cv', 'acceptance', 'report', 'evaluation'], true)) {
            Audit::log('file.downloaded', $file, ['kind' => $file->kind]);
        }
        $disposition = ($inline ? 'inline' : 'attachment').'; filename="'.addcslashes($file->original_name, '"\\').'"';

        return $this->disk()->temporaryUrl($file->storage_key, now()->addMinutes(config('placement.uploads.presign_minutes')), [
            'ResponseContentType' => $file->mime, 'ResponseContentDisposition' => $disposition,
        ]);
    }

    public function contents(StoredFile $file): string
    {
        return (string) $this->disk()->get($file->storage_key);
    }

    public function put(string $kind, string $mime, string $name, string $bytes, ?User $by = null): StoredFile
    {
        $ext = ['application/pdf' => 'pdf', 'image/png' => 'png'][$mime] ?? 'bin';
        $file = StoredFile::create(['kind' => $kind, 'storage_key' => $kind.'/'.now()->format('Y/m').'/'.Str::uuid().'.'.$ext,
            'original_name' => $name, 'mime' => $mime, 'size_bytes' => strlen($bytes), 'status' => 'ready', 'uploaded_by' => $by?->id]);
        $this->disk()->put($file->storage_key, $bytes);

        return $file;
    }
}
