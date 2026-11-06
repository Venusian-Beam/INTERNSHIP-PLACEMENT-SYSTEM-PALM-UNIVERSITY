<?php

use App\Modules\Letters\LetterRenderer;
use App\Modules\Letters\Models\Letter;
use App\Modules\Organisations\Models\Organisation;

/** Phase 3 QA: hostile content must never become markup in previews or PDFs (XSS, dompdf file/SSRF access). */
it('escapes hostile organisation, student and template content', function () {
    $tpl = approvedTemplate();
    $tpl->update(['body' => '<img src="file:///etc/passwd"><script>alert(1)</script> {{organisation.name}} {{students.table}}']);
    $org = Organisation::create(['name' => '<script>alert("org")</script>', 'email' => 'x@o.example', 'status' => 'active',
        'contact_person' => '<img src=x onerror=alert(2)>', 'address' => '"><iframe src=javascript:alert(3)>']);
    [$student] = matchedStudent($org);
    $student->studentProfile->update(['full_name' => '<b onmouseover=alert(4)>Evil</b>', 'programme' => '<svg onload=alert(5)>']);

    actingAsRole('staff');
    $this->postJson('/api/letters/generate')->assertOk();
    $res = $this->get('/api/letters/'.Letter::first()->id.'/preview')->assertOk();
    $html = $res->getContent();

    foreach (['<script', '<img src="file', '<iframe', '<svg', '<b onmouseover', 'onerror=alert'] as $danger) {
        expect(stripos($html, $danger))->toBeFalse("found raw: {$danger}");
    }
    expect($html)->toContain('&lt;script&gt;alert(&quot;org&quot;)&lt;/script&gt;');
    expect($res->headers->get('Content-Security-Policy'))->toContain("default-src 'none'");

    // The PDF renders without fetching anything (isRemoteEnabled=false, no injected tags).
    $pdf = app(LetterRenderer::class)->pdf($html);
    expect(substr($pdf, 0, 5))->toBe('%PDF-');
});
