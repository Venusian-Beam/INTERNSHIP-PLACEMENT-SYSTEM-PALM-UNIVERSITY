<?php

use App\Modules\Identity\Models\OtpCode;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Students\Models\StudentProfile;
use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\Hash;

/** Regression tests for the security assessment findings (docs/security/security-assessment.md). */
it('SEC-02: API responses carry defensive headers', function () {
    actingAsRole('student');
    $r = $this->getJson('/api/auth/me')->assertOk();
    expect($r->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($r->headers->get('X-Frame-Options'))->toBe('DENY')
        ->and($r->headers->get('Referrer-Policy'))->toBe('no-referrer')
        ->and($r->headers->get('Cache-Control'))->toContain('no-store');
});

it('SEC-02: production refuses to start with debug on or without the BFF key', function () {
    app()->detectEnvironment(fn () => 'production');
    config(['app.debug' => true, 'placement.bff_key' => '', 'placement.cron_secret' => 'dev-cron-secret-change-me']);
    expect(fn () => (new AppServiceProvider(app()))->boot())->toThrow(RuntimeException::class, 'APP_DEBUG must be false');

    config(['app.debug' => false, 'placement.bff_key' => str_repeat('k', 40), 'placement.cron_secret' => str_repeat('s', 40)]);
    (new AppServiceProvider(app()))->boot(); // no exception
    app()->detectEnvironment(fn () => 'testing');
});

it('SEC-03: the API grants no cross-origin access', function () {
    $r = $this->call('OPTIONS', '/api/auth/login', [], [], [], ['HTTP_ORIGIN' => 'https://evil.example', 'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST']);
    expect($r->headers->get('Access-Control-Allow-Origin'))->toBeNull();
});

it('SEC-04: students never see other students\' pending proposals in duplicate suggestions', function () {
    $other = StudentProfile::create(['university_email' => 'x@'.config('placement.student_email_domain'), 'full_name' => 'Other']);
    Organisation::create(['name' => 'Secret Startup Ltd', 'status' => 'pending_check', 'proposed_by_student_id' => $other->id]);
    Organisation::create(['name' => 'Secret Startup Holdings', 'email' => 'a@b.example', 'status' => 'active']);
    actingAsRole('student');
    $names = collect($this->getJson('/api/organisations/similar?name=Secret Startup')->assertOk()->json('similar'))->pluck('name');
    expect($names->all())->toBe(['Secret Startup Holdings']);
    actingAsRole('staff');
    expect(collect($this->getJson('/api/organisations/similar?name=Secret Startup')->json('similar')))->toHaveCount(2);
});

it('SEC-05: login codes stop being issued after too many wrong guesses in a day', function () {
    $u = makeUser('staff', ['password' => 'Secret12345']);
    OtpCode::create(['user_id' => $u->id, 'challenge_hash' => hash('sha256', 'x'), 'code_hash' => Hash::make('1'), 'expires_at' => now(),
        'consumed_at' => now(), 'attempts' => 15]);
    $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'Secret12345'])->assertStatus(429)->assertJsonPath('code', 'otp_locked');
});

it('QA-4-01: malformed report and list filters are rejected with 422, never a 500', function (string $url) {
    actingAsRole('staff');
    $this->getJson($url)->assertUnprocessable();
})->with(['/api/reports/graduation?level=abc', '/api/reports/graduation?status=x\'--', '/api/reports/graduation?programme[]=x',
    '/api/students?level=abc', '/api/students?registry=maybe', '/api/students?stage=bogus', '/api/reports/pipeline?cycle_id=abc']);

it('QA-4-02: malformed route IDs are a 404, never a 500', function (string $method, string $url) {
    actingAsRole('head');
    $this->json($method, $url)->assertNotFound();
})->with([['GET', '/api/students/abc'], ['GET', '/api/students/99999999999999999999'], ['GET', '/api/files/abc/download'],
    ['GET', '/api/letters/abc/preview'], ['POST', '/api/applications/abc/outcome'], ['POST', '/api/placements/abc/confirm'],
    ['POST', '/api/organisations/abc/approve'], ['PATCH', '/api/cycles/abc'], ['GET', '/api/letter-template/abc/preview'], ['PATCH', '/api/staff/accounts/abc']]);
