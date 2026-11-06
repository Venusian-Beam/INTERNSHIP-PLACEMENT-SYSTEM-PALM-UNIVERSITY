<?php

use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\Models\StoredFile;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use App\Modules\Students\Models\StudentProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function openCycle(array $o = []): Cycle
{
    return Cycle::create(array_merge(['name' => 'Cycle '.uniqid(), 'applications_open_at' => now()->subDay(), 'applications_close_at' => now()->addMonth(),
        'letter_cutoff_at' => now()->addMonths(3), 'default_period_start' => now()->addMonths(4)->toDateString(), 'default_period_end' => now()->addMonths(6)->toDateString()], $o));
}

function org(string $status = 'active', array $o = []): Organisation
{
    return Organisation::create(array_merge(['name' => 'Org '.uniqid(), 'email' => 'hr'.uniqid().'@org.example', 'status' => $status], $o));
}

/** A real object in the (local S3) bucket, uploaded by $user, already confirmed. */
function readyFile($user, string $kind = 'cv', string $bytes = '%PDF-1.4 test', string $mime = 'application/pdf'): StoredFile
{
    $f = StoredFile::create(['kind' => $kind, 'storage_key' => "test/{$kind}/".uniqid().'.bin', 'original_name' => "{$kind}.pdf", 'mime' => $mime,
        'size_bytes' => strlen($bytes), 'status' => 'ready', 'uploaded_by' => $user->id]);
    Storage::disk('s3')->put($f->storage_key, $bytes);

    return $f;
}

function completeStudent(): array
{
    $u = actingAsRole('student');
    $p = $u->studentProfile;
    $p->update(['student_number' => (string) random_int(1e7, 9e7), 'phone' => '0240000000', 'cv_file_id' => readyFile($u)->id]);

    return [$u, $p->fresh()];
}

describe('Files (FR-X3, NFR-S6/S9)', function () {
    it('issues presigned uploads only for allowed roles, types and sizes', function () {
        actingAsRole('student');
        $this->postJson('/api/files/uploads', ['kind' => 'cv', 'mime' => 'application/pdf', 'size' => 1000, 'name' => 'cv.pdf'])->assertCreated()->assertJsonStructure(['file_id', 'url']);
        $this->postJson('/api/files/uploads', ['kind' => 'cv', 'mime' => 'text/html', 'size' => 1000, 'name' => 'x.html'])->assertUnprocessable();
        $this->postJson('/api/files/uploads', ['kind' => 'cv', 'mime' => 'application/pdf', 'size' => 5 * 1024 * 1024, 'name' => 'big.pdf'])->assertUnprocessable();
        $this->postJson('/api/files/uploads', ['kind' => 'signature', 'mime' => 'image/png', 'size' => 100, 'name' => 's.png'])->assertForbidden();
        $this->postJson('/api/files/uploads', ['kind' => 'evaluation', 'mime' => 'application/pdf', 'size' => 100, 'name' => 'e.pdf'])->assertForbidden();
    });

    it('confirms only real PDFs (magic bytes) and deletes fakes', function () {
        $u = actingAsRole('student');
        $good = StoredFile::create(['kind' => 'cv', 'storage_key' => 'test/'.uniqid().'.pdf', 'original_name' => 'cv.pdf', 'mime' => 'application/pdf', 'size_bytes' => 10, 'status' => 'pending', 'uploaded_by' => $u->id]);
        Storage::disk('s3')->put($good->storage_key, '%PDF-1.7 real');
        $this->postJson("/api/files/{$good->id}/confirm")->assertOk();

        $bad = StoredFile::create(['kind' => 'cv', 'storage_key' => 'test/'.uniqid().'.pdf', 'original_name' => 'x.pdf', 'mime' => 'application/pdf', 'size_bytes' => 10, 'status' => 'pending', 'uploaded_by' => $u->id]);
        Storage::disk('s3')->put($bad->storage_key, '<script>alert(1)</script>');
        $this->postJson("/api/files/{$bad->id}/confirm")->assertUnprocessable();
        expect(StoredFile::find($bad->id))->toBeNull()->and(Storage::disk('s3')->exists($bad->storage_key))->toBeFalse();
    });

    it('lets owners and Career Services download, audits staff access, never serves signatures', function () {
        [$u, $p] = completeStudent();
        $this->getJson("/api/files/{$p->cv_file_id}/download")->assertOk()->assertJsonStructure(['url']);
        actingAsRole('student');
        $this->getJson("/api/files/{$p->cv_file_id}/download")->assertNotFound(); // another student
        actingAsRole('president');
        $this->getJson("/api/files/{$p->cv_file_id}/download")->assertNotFound();
        actingAsRole('staff');
        $this->getJson("/api/files/{$p->cv_file_id}/download")->assertOk();
        expect(DB::table('audit_log')->where('action', 'file.downloaded')->count())->toBe(1);
        $head = actingAsRole('head');
        $sig = readyFile($head, 'signature', "\x89PNG\r\n\x1a\nxx", 'image/png');
        $this->getJson("/api/files/{$sig->id}/download")->assertNotFound();
    });

    it('cannot attach someone else\'s upload as your CV', function () {
        $other = makeUser('student');
        $f = readyFile($other);
        actingAsRole('student');
        $this->patchJson('/api/student/profile', ['cv_file_id' => $f->id])->assertUnprocessable();
    });
});

describe('Applications (FR-P1/P2, BR1, BR3)', function () {
    it('saves a draft and submits a complete application once', function () {
        openCycle();
        [$u, $p] = completeStudent();
        $a = org();
        $b = org();
        $this->putJson('/api/student/application', ['motivation' => 'I want telecom experience.', 'choices' => [$a->id, $b->id]])->assertOk()
            ->assertJsonPath('application.choices.0.organisation_id', $a->id);
        $this->postJson('/api/student/application/submit')->assertOk()->assertJsonPath('application.status', 'submitted');
        $this->postJson('/api/student/application/submit')->assertUnprocessable();
        $this->putJson('/api/student/application', ['motivation' => 'changed', 'choices' => [$a->id]])->assertUnprocessable();
        expect(Application::count())->toBe(1);
    });

    it('refuses submission with an incomplete profile, no CV or no choices', function () {
        openCycle();
        actingAsRole('student');
        $this->putJson('/api/student/application', ['motivation' => '', 'choices' => []])->assertOk();
        $this->postJson('/api/student/application/submit')->assertUnprocessable()->assertJsonValidationErrors(['profile', 'cv', 'motivation', 'choices']);
    });

    it('refuses applications outside the window (BR1), unless staff admitted a late one', function () {
        openCycle(['applications_open_at' => now()->subMonths(2), 'applications_close_at' => now()->subDay()]);
        [$u, $p] = completeStudent();
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => []])->assertUnprocessable()->assertJsonValidationErrors('cycle');

        Sanctum::actingAs(makeUser('staff'));
        $this->postJson('/api/applications/late-admit', ['student_profile_id' => $p->id])->assertCreated();
        Sanctum::actingAs($u);
        $a = org();
        $this->putJson('/api/student/application', ['motivation' => 'Late but keen.', 'choices' => [$a->id]])->assertOk();
        $this->postJson('/api/student/application/submit')->assertOk();
        expect(Application::first()->late_admitted_by)->not->toBeNull();
    });

    it('only allows active organisations or the student\'s own pending proposals as choices', function () {
        openCycle();
        [$u, $p] = completeStudent();
        $rejected = org('rejected');
        $othersPending = org('pending_check', ['proposed_by_student_id' => StudentProfile::create(['university_email' => 'z@'.config('placement.student_email_domain'), 'full_name' => 'Z'])->id]);
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => [$rejected->id]])->assertUnprocessable();
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => [$othersPending->id]])->assertUnprocessable();
        $own = $this->postJson('/api/student/organisations', ['name' => 'Accra Startup Hub', 'email' => 'hi@ash.example'])->assertCreated()->json('organisation.id');
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => [$own]])->assertOk();
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => [1, 2, 3, 4]])->assertUnprocessable();
    });

    it('hides other organisations\' private contact details and other students\' proposals from students', function () {
        $a = org('active', ['contact_person' => 'Secret Person']);
        org('pending_check');
        actingAsRole('student');
        $list = $this->getJson('/api/organisations')->assertOk()->json('organisations');
        expect(collect($list)->pluck('id')->all())->toBe([$a->id])->and($list[0])->not->toHaveKey('contact_person');
    });
});

describe('Organisation checks (FR-O4, BR3)', function () {
    it('approves, rejects with a reason, and merges duplicates moving the student\'s choice', function () {
        openCycle();
        [$u, $p] = completeStudent();
        $existing = org('active', ['name' => 'Volta Telecom Ltd']);
        $dupe = $this->postJson('/api/student/organisations', ['name' => 'Volta Telecoms Limited'])->assertCreated()->json('organisation.id');
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => [$dupe]])->assertOk();

        actingAsRole('staff');
        $queue = $this->getJson('/api/organisations-queue')->assertOk()->json('queue');
        expect($queue[0]['similar'][0]['name'])->toBe('Volta Telecom Ltd');
        $this->postJson("/api/organisations/{$dupe}/merge", ['into_id' => $existing->id])->assertOk();
        expect(Application::first()->choices()->first()->organisation_id)->toBe($existing->id);
        $this->postJson("/api/organisations/{$dupe}/approve")->assertUnprocessable(); // already checked

        $noEmail = org('pending_check', ['email' => null]);
        $this->postJson("/api/organisations/{$noEmail->id}/approve")->assertUnprocessable();
        $this->postJson("/api/organisations/{$noEmail->id}/reject", ['reason' => 'Could not verify registration.'])->assertOk();
        expect($noEmail->fresh()->status)->toBe('rejected');
        expect(DB::table('email_log')->where('type', 'org_check')->count())->toBe(1);
    });

    it('stops students from checking organisations', function () {
        $o = org('pending_check');
        actingAsRole('student');
        $this->postJson("/api/organisations/{$o->id}/approve")->assertForbidden();
        $this->getJson('/api/organisations-queue')->assertForbidden();
    });
});

describe('Interview outcome and matching (FR-P4–P7, BR2)', function () {
    it('records a pass with an active match, creates the placement and emails the student', function () {
        $cycle = openCycle();
        [$u, $p] = completeStudent();
        $o = org();
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => [$o->id]]);
        $this->postJson('/api/student/application/submit')->assertOk();
        $app = Application::first();

        actingAsRole('staff');
        $pending = org('pending_check');
        $this->postJson("/api/applications/{$app->id}/outcome", ['interview_date' => today()->toDateString(), 'result' => 'pass', 'matched_organisation_id' => $pending->id])->assertUnprocessable();
        $this->postJson("/api/applications/{$app->id}/outcome", ['interview_date' => today()->toDateString(), 'result' => 'pass', 'matched_organisation_id' => $o->id])->assertOk();
        expect(Placement::where('application_id', $app->id)->value('status'))->toBe('letter_pending');
        $this->postJson("/api/applications/{$app->id}/outcome", ['interview_date' => today()->toDateString(), 'result' => 'not_recommended'])->assertUnprocessable();
        expect(DB::table('email_log')->where('type', 'interview_outcome')->count())->toBe(1);
    });

    it('closes a not-recommended application with no placement', function () {
        openCycle();
        [$u, $p] = completeStudent();
        $o = org();
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => [$o->id]]);
        $this->postJson('/api/student/application/submit');
        $app = Application::first();
        actingAsRole('head');
        $this->postJson("/api/applications/{$app->id}/outcome", ['interview_date' => today()->toDateString(), 'result' => 'not_recommended', 'notes' => 'Not ready'])->assertOk();
        expect($app->fresh()->status)->toBe('not_recommended')->and(Placement::count())->toBe(0);
    });

    it('blocks students from recording outcomes or viewing other applications', function () {
        openCycle();
        [$u, $p] = completeStudent();
        $this->putJson('/api/student/application', ['motivation' => 'x', 'choices' => []]);
        $app = Application::first();
        actingAsRole('student');
        $this->getJson("/api/applications/{$app->id}")->assertForbidden();
        $this->postJson("/api/applications/{$app->id}/outcome", ['interview_date' => today()->toDateString(), 'result' => 'not_recommended'])->assertForbidden();
    });
});

describe('Cycles and registry import (FR-C1, FR-S2, UI-D8)', function () {
    it('lets only the Head manage cycles', function () {
        $payload = ['name' => 'Long break 2030', 'applications_open_at' => '2030-03-01', 'applications_close_at' => '2030-04-30',
            'letter_cutoff_at' => '2030-07-15', 'default_period_start' => '2030-06-01', 'default_period_end' => '2030-08-31'];
        actingAsRole('staff');
        $this->postJson('/api/cycles', $payload)->assertForbidden();
        actingAsRole('head');
        $this->postJson('/api/cycles', $payload)->assertCreated();
        $this->postJson('/api/cycles', array_merge($payload, ['name' => 'Bad', 'applications_close_at' => '2030-02-01']))->assertUnprocessable();
    });

    it('previews and imports the registry CSV, rejecting bad and formula rows', function () {
        $head = actingAsRole('head');
        $d = config('placement.student_email_domain');
        $csv = "email,full_name,student_number,programme,level\n"
            ."new.one@{$d},New One,S001,Nursing,200\n"
            ."bad@gmail.com,Wrong Domain,S002,Nursing,200\n"
            ."evil@{$d},=HYPERLINK(\"http://x\"),S003,Nursing,200\n"
            ."new.one@{$d},Duplicate,S004,Nursing,200\n";
        $f = readyFile($head, 'registry_csv', $csv, 'text/csv');
        $prev = $this->postJson('/api/registry/preview', ['file_id' => $f->id])->assertOk()->json();
        expect($prev['valid'])->toBe(1)->and($prev['error_count'])->toBe(3)->and(StudentProfile::where('university_email', "new.one@{$d}")->exists())->toBeFalse();
        $this->postJson('/api/registry/import', ['file_id' => $f->id])->assertOk()->assertJsonPath('created', 1);
        expect(StudentProfile::where('university_email', "new.one@{$d}")->first()->on_registry)->toBeTrue();
        actingAsRole('staff');
        $this->postJson('/api/registry/import', ['file_id' => $f->id])->assertForbidden();
    });
});
