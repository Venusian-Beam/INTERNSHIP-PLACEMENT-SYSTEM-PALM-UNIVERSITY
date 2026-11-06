<?php

use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\Models\StoredFile;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Storage;

/** Post the bytes to storage exactly as the browser does (multipart form with the policy fields). */
function postToStorage(array $presign, string $bytes): int
{
    $multipart = [];
    foreach ($presign['fields'] as $k => $v) {
        $multipart[] = ['name' => $k, 'contents' => $v];
    }
    $multipart[] = ['name' => 'file', 'contents' => $bytes, 'filename' => 'x.pdf'];

    return (new Client(['http_errors' => false]))->post($presign['url'], ['multipart' => $multipart])->getStatusCode();
}

it('QA-2-01: storage itself refuses an upload larger than the declared size', function () {
    actingAsRole('student');
    $p = $this->postJson('/api/files/uploads', ['kind' => 'cv', 'mime' => 'application/pdf', 'size' => 100, 'name' => 'cv.pdf'])->assertCreated()->json();
    expect(postToStorage($p, '%PDF-1.4 '.str_repeat('A', 5000)))->toBe(400);
    expect(Storage::disk('s3')->exists(StoredFile::find($p['file_id'])->storage_key))->toBeFalse();

    $ok = $this->postJson('/api/files/uploads', ['kind' => 'cv', 'mime' => 'application/pdf', 'size' => 20, 'name' => 'cv.pdf'])->json();
    expect(postToStorage($ok, '%PDF-1.4 fine'))->toBeIn([200, 201, 204]);
    $this->postJson("/api/files/{$ok['file_id']}/confirm")->assertOk();
});

it('QA-2-01: abandoned uploads older than an hour are swept', function () {
    $u = actingAsRole('student');
    $stale = StoredFile::create(['kind' => 'cv', 'storage_key' => 'test/stale-'.uniqid().'.pdf', 'original_name' => 's.pdf', 'mime' => 'application/pdf',
        'size_bytes' => 10, 'status' => 'pending', 'uploaded_by' => $u->id]);
    StoredFile::whereKey($stale->id)->update(['created_at' => now()->subHours(2)]);
    $this->postJson('/api/files/uploads', ['kind' => 'cv', 'mime' => 'application/pdf', 'size' => 10, 'name' => 'n.pdf'])->assertCreated();
    expect(StoredFile::find($stale->id))->toBeNull();
});

it('QA-2-02: an outcome submitted twice is recorded once with one placement', function () {
    $cycle = Cycle::create(['name' => 'C', 'applications_open_at' => now()->subDay(), 'applications_close_at' => now()->addDay(),
        'letter_cutoff_at' => now()->addMonth(), 'default_period_start' => now()->addMonths(2), 'default_period_end' => now()->addMonths(3)]);
    $student = makeUser('student');
    $org = Organisation::create(['name' => 'O', 'email' => 'o@o.example', 'status' => 'active']);
    $app = Application::create(['student_profile_id' => $student->studentProfile->id, 'cycle_id' => $cycle->id, 'status' => 'submitted', 'submitted_at' => now()]);
    actingAsRole('staff');
    $body = ['interview_date' => today()->toDateString(), 'result' => 'pass', 'matched_organisation_id' => $org->id];
    $this->postJson("/api/applications/{$app->id}/outcome", $body)->assertOk();
    $this->postJson("/api/applications/{$app->id}/outcome", $body)->assertUnprocessable();
    expect(Placement::where('application_id', $app->id)->count())->toBe(1);
});
