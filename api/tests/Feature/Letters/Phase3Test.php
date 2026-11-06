<?php

use App\Models\User;
use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\Models\StoredFile;
use App\Modules\Letters\LetterMail;
use App\Modules\Letters\LetterRenderer;
use App\Modules\Letters\Models\Letter;
use App\Modules\Letters\Models\LetterTemplate;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function s3File(User $u, string $kind, string $bytes = '%PDF-1.4 x'): StoredFile
{
    $f = StoredFile::create(['kind' => $kind, 'storage_key' => "test/{$kind}/".uniqid().'.pdf', 'original_name' => "{$kind}.pdf",
        'mime' => 'application/pdf', 'size_bytes' => strlen($bytes), 'status' => 'ready', 'uploaded_by' => $u->id]);
    Storage::disk('s3')->put($f->storage_key, $bytes);

    return $f;
}

function approvedTemplate(): LetterTemplate
{
    return LetterTemplate::create(['version' => (int) LetterTemplate::max('version') + 1, 'body' => LetterRenderer::DEFAULT_BODY,
        'status' => 'approved', 'created_by' => makeUser('head')->id, 'decided_at' => now()]);
}

/** A matched student (placement letter_pending) at $org in an open cycle. Returns [studentUser, placement]. */
function matchedStudent(Organisation $org, ?Cycle $cycle = null): array
{
    $cycle ??= Cycle::first() ?? Cycle::create(['name' => 'C '.uniqid(), 'applications_open_at' => now()->subDay(), 'applications_close_at' => now()->addDay(),
        'letter_cutoff_at' => now()->addMonth(), 'default_period_start' => now()->addMonths(2)->toDateString(), 'default_period_end' => now()->addMonths(4)->toDateString()]);
    $u = makeUser('student');
    $u->studentProfile->update(['cv_file_id' => s3File($u, 'cv')->id]);
    $app = Application::create(['student_profile_id' => $u->studentProfile->id, 'cycle_id' => $cycle->id, 'status' => 'passed',
        'matched_organisation_id' => $org->id, 'submitted_at' => now()]);
    $p = Placement::create(['application_id' => $app->id, 'student_profile_id' => $u->studentProfile->id, 'organisation_id' => $org->id,
        'cycle_id' => $cycle->id, 'status' => 'letter_pending']);

    return [$u, $p];
}

function activeOrg(): Organisation
{
    return Organisation::create(['name' => 'Org '.uniqid(), 'email' => 'hr'.uniqid().'@org.example', 'status' => 'active', 'contact_person' => 'The HR Manager']);
}

describe('Template approval (FR-T, BR4, D4, D6)', function () {
    it('Head drafts and submits; President approves; the old version is superseded', function () {
        $old = approvedTemplate();
        $head = actingAsRole('head');
        $this->putJson('/api/letter-template/draft', ['body' => 'Hello {{student.id}} {{students.table}}'])->assertUnprocessable();
        $this->putJson('/api/letter-template/draft', ['body' => 'Hello {{organisation.name}}'])->assertUnprocessable(); // no table
        $id = $this->putJson('/api/letter-template/draft', ['body' => LetterRenderer::DEFAULT_BODY.' v2'])->assertOk()->json('template.id');
        $this->postJson("/api/letter-template/{$id}/submit")->assertOk();
        $this->putJson('/api/letter-template/draft', ['body' => LetterRenderer::DEFAULT_BODY])->assertUnprocessable(); // locked while with President
        $this->postJson("/api/president/template/{$id}/approve")->assertForbidden(); // Head can't approve

        actingAsRole('president');
        $this->getJson('/api/president/template')->assertOk()->assertJsonPath('pending.id', $id);
        $this->getJson('/api/letter-template')->assertForbidden(); // President sees only the review
        $this->postJson("/api/president/template/{$id}/approve")->assertOk();
        expect(LetterTemplate::approved()->id)->toBe($id)->and($old->fresh()->status)->toBe('superseded');
    });

    it('remarks keep the last approved version in force and a revision starts a new version', function () {
        $approved = approvedTemplate();
        actingAsRole('head');
        $id = $this->putJson('/api/letter-template/draft', ['body' => LetterRenderer::DEFAULT_BODY.' x'])->json('template.id');
        $this->postJson("/api/letter-template/{$id}/submit");
        actingAsRole('president');
        $this->postJson("/api/president/template/{$id}/remarks", ['remarks' => 'Shorten paragraph 2'])->assertOk();
        expect(LetterTemplate::approved()->id)->toBe($approved->id);
        actingAsRole('head');
        $new = $this->putJson('/api/letter-template/draft', ['body' => LetterRenderer::DEFAULT_BODY.' shorter'])->json('template');
        expect($new['version'])->toBeGreaterThan(LetterTemplate::find($id)->version);
        // QA-3-01 regression: the rejected version keeps its remarks in the President's history.
        expect(LetterTemplate::find($id)->status)->toBe('remarks');
        actingAsRole('president');
        expect(collect($this->getJson('/api/president/template')->json('history'))->firstWhere('id', $id)['remarks'])->toBe('Shorten paragraph 2');
    });

    it('blocks staff and students from the template', function (string $role) {
        actingAsRole($role);
        $this->getJson('/api/letter-template')->assertForbidden();
    })->with(['staff', 'student']);
});

describe('Letters (FR-L, BR5)', function () {
    it('will not generate letters without an approved template (BR4)', function () {
        matchedStudent(activeOrg());
        actingAsRole('staff');
        $this->postJson('/api/letters/generate')->assertUnprocessable()->assertJsonValidationErrors('template');
    });

    it('groups matched students by organisation into one letter and never prints a student ID', function () {
        approvedTemplate();
        $org = activeOrg();
        [$a] = matchedStudent($org);
        [$b] = matchedStudent($org);
        $a->studentProfile->update(['student_number' => 'SECRET-ID-123']);
        matchedStudent(activeOrg());
        actingAsRole('staff');
        $this->postJson('/api/letters/generate')->assertOk()->assertJsonPath('created', 2);
        $letter = Letter::where('organisation_id', $org->id)->first();
        expect($letter->placements()->count())->toBe(2);
        $html = $this->get("/api/letters/{$letter->id}/preview")->assertOk()->getContent();
        expect($html)->toContain(e($a->studentProfile->full_name))->not->toContain('SECRET-ID-123');
        $this->postJson('/api/letters/generate')->assertJsonPath('created', 0); // idempotent
    });

    it('sends by email with the PDF and CVs, marks sent, and the sent letter can never change', function () {
        Mail::fake();
        approvedTemplate();
        $org = activeOrg();
        [$student] = matchedStudent($org);
        actingAsRole('staff');
        $this->postJson('/api/letters/generate');
        $letter = Letter::first();
        $this->postJson("/api/letters/{$letter->id}/send")->assertOk()->assertJsonPath('letter.status', 'sent');
        Mail::assertSent(LetterMail::class, fn ($m) => $m->hasTo($org->email) && count($m->attachments()) === 2);
        expect(Placement::first()->status)->toBe('letter_sent')->and($letter->fresh()->pdf_file_id)->not->toBeNull();
        expect(DB::table('email_log')->where('type', 'letter_sent')->count())->toBe(1);
        expect(DB::table('audit_log')->where('action', 'letter.sent')->count())->toBe(1);

        $this->postJson("/api/letters/{$letter->id}/send")->assertUnprocessable(); // no double send
        $this->patchJson("/api/letters/{$letter->id}", ['period_start' => '2030-01-01', 'period_end' => '2030-02-01'])->assertUnprocessable();
        // Database guard (BR5); run inside a savepoint so the test transaction survives the expected error.
        expect(fn () => DB::transaction(fn () => DB::table('letters')->where('id', $letter->id)->update(['recipient_email' => 'x@y.z'])))
            ->toThrow(QueryException::class);

        // D8: the student can download their own sent letter; another student cannot.
        Sanctum::actingAs($student);
        $this->getJson("/api/files/{$letter->fresh()->pdf_file_id}/download")->assertOk();
        actingAsRole('student');
        $this->getJson("/api/files/{$letter->fresh()->pdf_file_id}/download")->assertNotFound();
    });

    it('marks a failed send as Failed, never Sent (NFR-R3)', function () {
        approvedTemplate();
        matchedStudent(activeOrg());
        actingAsRole('staff');
        $this->postJson('/api/letters/generate');
        Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP timeout'));
        $letter = Letter::first();
        $this->postJson("/api/letters/{$letter->id}/send")->assertStatus(502);
        expect($letter->fresh()->status)->toBe('failed')->and(Placement::first()->status)->toBe('letter_pending');
    });

    it('supports the manual route and blocks letters after the cut-off', function () {
        approvedTemplate();
        $cycle = Cycle::create(['name' => 'Past', 'applications_open_at' => now()->subMonths(3), 'applications_close_at' => now()->subMonths(2),
            'letter_cutoff_at' => now()->addDay(), 'default_period_start' => now()->toDateString(), 'default_period_end' => now()->addMonth()->toDateString()]);
        matchedStudent(activeOrg(), $cycle);
        actingAsRole('staff');
        $this->postJson('/api/letters/generate')->assertOk();
        $letter = Letter::first();
        $this->get("/api/letters/{$letter->id}/pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->postJson("/api/letters/{$letter->id}/mark-sent")->assertOk()->assertJsonPath('letter.send_mode', 'manual');

        $cycle->update(['letter_cutoff_at' => now()->subMinute()]);
        matchedStudent(activeOrg(), $cycle);
        $this->postJson('/api/letters/generate')->assertUnprocessable()->assertJsonValidationErrors('cycle');
    });

    it('removes a student from an unsent letter back to the pool', function () {
        approvedTemplate();
        $org = activeOrg();
        [, $p1] = matchedStudent($org);
        matchedStudent($org);
        actingAsRole('staff');
        $this->postJson('/api/letters/generate');
        $letter = Letter::first();
        $this->postJson("/api/letters/{$letter->id}/remove-student", ['placement_id' => $p1->id])->assertOk();
        expect($p1->fresh()->letter_id)->toBeNull()->and($letter->placements()->count())->toBe(1);
    });

    it('stops students using the letter workspace', function () {
        actingAsRole('student');
        $this->getJson('/api/letters/workspace')->assertForbidden();
        $this->postJson('/api/letters/generate')->assertForbidden();
    });
});

describe('Placements (FR-PL, BR6–BR8)', function () {
    function sentPlacement(): array
    {
        Mail::fake();
        approvedTemplate();
        [$student, $p] = matchedStudent(activeOrg());
        $staff = makeUser('staff');
        Sanctum::actingAs($staff);
        test()->postJson('/api/letters/generate');
        test()->postJson('/api/letters/'.Letter::first()->id.'/send')->assertOk();

        return [$student, $p->fresh(), $staff];
    }

    it('student records acceptance with a letter; staff confirm; report + evaluation; Head completes', function () {
        [$student, $p, $staff] = sentPlacement();
        Sanctum::actingAs($student);
        $this->postJson("/api/student/placements/{$p->id}/reply", ['result' => 'accepted'])->assertUnprocessable(); // needs file
        $acc = s3File($student, 'acceptance');
        $this->postJson("/api/student/placements/{$p->id}/reply", ['result' => 'accepted', 'acceptance_file_id' => $acc->id])->assertOk()->assertJsonPath('placement.status', 'acceptance_submitted');
        $this->postJson("/api/student/placements/{$p->id}/reply", ['result' => 'declined'])->assertUnprocessable(); // once

        Sanctum::actingAs($staff);
        $this->postJson("/api/placements/{$p->id}/confirm")->assertOk()->assertJsonPath('placement.status', 'accepted');
        $this->postJson("/api/placements/{$p->id}/complete")->assertForbidden(); // Head only

        Sanctum::actingAs($student);
        $this->postJson("/api/student/placements/{$p->id}/report", ['file_id' => s3File($student, 'report')->id])->assertOk();
        Sanctum::actingAs($staff);
        $this->postJson("/api/placements/{$p->id}/evaluation", ['file_id' => s3File($staff, 'evaluation')->id])->assertOk();

        actingAsRole('head');
        $this->postJson("/api/placements/{$p->id}/complete")->assertOk()->assertJsonPath('placement.status', 'completed');
        expect(DB::table('audit_log')->where('action', 'placement.completed')->count())->toBe(1);
    });

    it('Head cannot complete without both documents', function () {
        [$student, $p, $staff] = sentPlacement();
        Sanctum::actingAs($staff);
        $this->postJson("/api/placements/{$p->id}/reply", ['result' => 'accepted', 'acceptance_file_id' => s3File($staff, 'acceptance')->id])->assertOk()->assertJsonPath('placement.status', 'accepted');
        actingAsRole('head');
        $this->postJson("/api/placements/{$p->id}/complete")->assertUnprocessable();
    });

    it('a decline puts the student in needs re-match; staff re-match to another active organisation', function () {
        [$student, $p, $staff] = sentPlacement();
        Sanctum::actingAs($student);
        $this->postJson("/api/student/placements/{$p->id}/reply", ['result' => 'declined'])->assertOk();
        Sanctum::actingAs($staff);
        $list = $this->getJson('/api/placements')->assertOk()->json('needs_rematch');
        expect($list)->toHaveCount(1);
        $new = activeOrg();
        $this->postJson('/api/placements/rematch', ['application_id' => $p->application_id, 'organisation_id' => $new->id])->assertCreated();
        $this->postJson('/api/placements/rematch', ['application_id' => $p->application_id, 'organisation_id' => $new->id])->assertUnprocessable(); // already open
        expect(Placement::where('application_id', $p->application_id)->where('status', 'letter_pending')->count())->toBe(1);
    });

    it('a student cannot act on another student\'s placement', function () {
        [$student, $p] = sentPlacement();
        actingAsRole('student');
        $this->postJson("/api/student/placements/{$p->id}/reply", ['result' => 'declined'])->assertNotFound();
    });
});
