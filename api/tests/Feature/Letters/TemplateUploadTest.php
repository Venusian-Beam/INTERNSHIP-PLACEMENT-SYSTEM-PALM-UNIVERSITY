<?php

use App\Modules\Files\FileService;
use App\Modules\Letters\LetterRenderer;
use App\Modules\Letters\Models\Letter;
use App\Modules\Letters\Models\LetterTemplate;
use App\Modules\Letters\TemplateSanitizer;
use App\Modules\Organisations\Models\Organisation;
use Barryvdh\DomPDF\Facade\Pdf;

/** Uploaded letter templates (FR-T1 upload flow): sanitising, required fields, rendering, PDF import, upload rules. */
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function readyTemplateHtml(): string
{
    return '<p style="text-align: right">Ref: <span data-field="reference">x</span> · <span data-field="date">x</span></p>'
        .'<p>Dear Sir/Madam,</p><p>We introduce <span data-field="students.names">x</span> to <span data-field="organisation.name">x</span>.</p>'
        .'<p><span data-field="students.table">x</span></p><p>Yours faithfully,</p><p><span data-signature="">x</span></p><p>President</p>';
}

it('keeps document formatting but strips anything active or remote', function () {
    $dirty = '<p style="text-align: center; position: fixed; background: url(http://evil.example/x)">Hello <strong>bold</strong></p>'
        .'<script>alert(1)</script><img src="x" onerror="alert(2)"><img src="http://evil.example/logo.png">'
        .'<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="><img src="data:image/png;base64,'.PNG_1PX.'" alt="Logo">'
        .'<a href="javascript:alert(3)">link</a><iframe src="https://evil.example"></iframe>'
        .'<table><tr><td colspan="2" onclick="x()" style="width: 50%">Cell</td></tr></table>'
        .'<span data-field="organisation.name"><img src=x onerror=alert(4)>sneaky</span>';

    $clean = TemplateSanitizer::clean($dirty);

    foreach (['<script', 'onerror', 'onclick', 'javascript:', 'evil.example', '<iframe', 'svg+xml', 'position', 'background', 'sneaky'] as $bad) {
        expect(stripos($clean, $bad))->toBeFalse("still contains {$bad}");
    }
    expect($clean)->toContain('<strong>bold</strong>')
        ->toContain('text-align: center')
        ->toContain('data:image/png;base64,')
        ->toContain('colspan="2"')
        ->toContain('width: 50%')
        ->toContain('<span data-field="organisation.name">Organisation name</span>');
});

it('rejects unknown fields and empty documents when saving', function () {
    actingAsRole('head');
    $this->putJson('/api/letter-template/draft', ['format' => 'html', 'body' => '<p><span data-field="student.id">x</span></p>'])
        ->assertStatus(422)->assertJsonPath('errors.body.0', 'Unknown field: student.id.');
    $this->putJson('/api/letter-template/draft', ['format' => 'html', 'body' => '<script>x</script>'])->assertStatus(422);
});

it('saves an uploaded template and only sends it once reference, organisation, students and signature are placed', function () {
    actingAsRole('head');
    $incomplete = '<p>Dear <span data-field="organisation.name">x</span>, <span data-field="students.table">x</span></p>';
    $id = $this->putJson('/api/letter-template/draft', ['format' => 'html', 'body' => $incomplete])->assertOk()->json('template.id');
    expect(LetterTemplate::find($id)->format)->toBe('html');

    $this->postJson("/api/letter-template/{$id}/submit")->assertStatus(422)
        ->assertJsonPath('errors.status.0', 'Before sending to the President, add the reference number, the signature.');

    $this->putJson('/api/letter-template/draft', ['format' => 'html', 'body' => readyTemplateHtml()])->assertOk();
    $this->postJson("/api/letter-template/{$id}/submit")->assertOk()->assertJsonPath('template.status', 'with_president');
});

it('renders an uploaded template with escaped values and the signature where it was placed', function () {
    $tpl = approvedTemplate();
    $tpl->update(['format' => 'html', 'body' => TemplateSanitizer::clean(readyTemplateHtml())]);
    $org = Organisation::create(['name' => '<b>"Evil" & Co</b>', 'email' => 'x@o.example', 'status' => 'active']);
    [$a] = matchedStudent($org);
    [$b] = matchedStudent($org);
    $a->studentProfile->update(['full_name' => 'Ama Mensah']);
    $b->studentProfile->update(['full_name' => 'Kofi <i>Boateng</i>']);

    actingAsRole('staff');
    $this->postJson('/api/letters/generate')->assertOk();
    $html = $this->get('/api/letters/'.Letter::first()->id.'/preview')->assertOk()->getContent();

    expect($html)->toContain('&lt;b&gt;&quot;Evil&quot; &amp; Co&lt;/b&gt;')
        ->toContain('Ama Mensah and Kofi &lt;i&gt;Boateng&lt;/i&gt;')
        ->toContain('<table class="students">')
        ->toContain('[Signature on file]')
        ->not->toContain('data-field')
        ->not->toContain('Office of Career Services'); // no system letterhead: it comes from the uploaded file
    expect(substr(app(LetterRenderer::class)->pdf($html), 0, 5))->toBe('%PDF-');
});

it('still renders plain-text templates with the system letterhead', function () {
    $html = app(LetterRenderer::class)->sample(LetterRenderer::DEFAULT_BODY);
    expect($html)->toContain('Office of Career Services')->toContain('Yours faithfully')->toContain('Student One');
});

it('turns an uploaded PDF into editable paragraphs (Head only)', function () {
    $head = actingAsRole('head');
    $pdf = Pdf::loadHTML('<p>Dear Sir/Madam,</p><p>We introduce our students.</p>')->output();
    $file = app(FileService::class)->put('template_source', 'application/pdf', 'letter.pdf', $pdf, $head);

    $html = $this->postJson('/api/letter-template/import', ['file_id' => $file->id])->assertOk()->json('html');
    expect($html)->toContain('<p>')->toContain('Dear Sir/Madam')->toContain('We introduce our students');

    $docx = app(FileService::class)->put('template_source', FileService::DOCX, 'letter.docx', "PK\x03\x04fake", $head);
    $this->postJson('/api/letter-template/import', ['file_id' => $docx->id])->assertStatus(422);

    actingAsRole('staff');
    $this->postJson('/api/letter-template/import', ['file_id' => $file->id])->assertForbidden();
});

it('lets only the Head upload a template file, as Word or PDF', function () {
    actingAsRole('staff');
    $this->postJson('/api/files/uploads', ['kind' => 'template_source', 'mime' => FileService::DOCX, 'size' => 2000, 'name' => 'letter.docx'])->assertForbidden();

    actingAsRole('head');
    $this->postJson('/api/files/uploads', ['kind' => 'template_source', 'mime' => FileService::DOCX, 'size' => 2000, 'name' => 'letter.docx'])->assertCreated();
    $this->postJson('/api/files/uploads', ['kind' => 'template_source', 'mime' => 'application/pdf', 'size' => 2000, 'name' => 'letter.pdf'])->assertCreated();
    $this->postJson('/api/files/uploads', ['kind' => 'template_source', 'mime' => 'application/msword', 'size' => 2000, 'name' => 'letter.doc'])
        ->assertStatus(422)->assertJsonPath('errors.mime.0', fn ($m) => str_contains($m, 'Save As .docx'));
});
