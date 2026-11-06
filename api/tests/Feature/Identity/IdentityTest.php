<?php

use App\Models\User;
use App\Modules\Identity\Models\Invitation;
use App\Modules\Identity\Models\OtpCode;
use App\Modules\Identity\Notifications\IdentityMail;
use App\Modules\Students\Models\StudentProfile;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;

function studentEmail(string $local = 'ama.mensah'): string
{
    return $local.'@'.config('placement.student_email_domain');
}

describe('FR-A1/A2 registration', function () {
    it('registers a student with a university email and privacy consent', function () {
        $this->postJson('/api/auth/register', [
            'name' => 'Ama Mensah', 'email' => studentEmail(), 'password' => 'Secret12345', 'password_confirmation' => 'Secret12345',
            'privacy_accepted' => true,
        ])->assertCreated();

        $user = User::where('email', studentEmail())->first();
        expect($user->role)->toBe('student')->and($user->privacy_accepted_at)->not->toBeNull()->and($user->email_verified_at)->toBeNull();
        expect(StudentProfile::where('user_id', $user->id)->exists())->toBeTrue();
        expect(DB::table('email_log')->where('type', 'verify')->count())->toBe(1);
    });

    it('rejects a non-university email domain', function () {
        $this->postJson('/api/auth/register', [
            'name' => 'X', 'email' => 'someone@gmail.com', 'password' => 'Secret12345', 'password_confirmation' => 'Secret12345', 'privacy_accepted' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    });

    it('requires privacy consent and a strong password', function () {
        $this->postJson('/api/auth/register', ['name' => 'X', 'email' => studentEmail('x'), 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertUnprocessable()->assertJsonValidationErrors(['password', 'privacy_accepted']);
    });

    it('does not reveal that an email is already registered', function () {
        makeUser('student', ['email' => studentEmail()]);
        $this->postJson('/api/auth/register', [
            'name' => 'Ama', 'email' => studentEmail(), 'password' => 'Secret12345', 'password_confirmation' => 'Secret12345', 'privacy_accepted' => true,
        ])->assertCreated();
        expect(User::where('email', studentEmail())->count())->toBe(1);
    });

    it('FR-A3 links registration to an imported registry record by email', function () {
        $profile = StudentProfile::create(['university_email' => studentEmail(), 'full_name' => 'Ama Mensah', 'programme' => 'Nursing', 'level' => 200, 'on_registry' => true]);
        $this->postJson('/api/auth/register', [
            'name' => 'Ama M', 'email' => strtoupper(studentEmail()), 'password' => 'Secret12345', 'password_confirmation' => 'Secret12345', 'privacy_accepted' => true,
        ])->assertCreated();
        expect($profile->fresh()->user_id)->toBe(User::where('email', studentEmail())->value('id'));
        expect(StudentProfile::count())->toBe(1);
    });
});

describe('email verification', function () {
    it('verifies through the signed link and rejects a tampered one', function () {
        $user = makeUser('student', ['email_verified_at' => null]);
        $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1($user->email)]);
        $this->get($url.'x')->assertRedirectContains('verified=invalid');
        expect($user->fresh()->email_verified_at)->toBeNull();
        $this->get($url)->assertRedirectContains('verified=1');
        expect($user->fresh()->email_verified_at)->not->toBeNull();
    });
});

describe('FR-A5 login', function () {
    it('logs a verified student straight in with a token', function () {
        $u = makeUser('student', ['password' => 'Secret12345']);
        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'Secret12345'])
            ->assertOk()->assertJsonStructure(['token', 'user' => ['role']])->assertJsonPath('user.role', 'student');
    });

    it('blocks unverified students and deactivated accounts', function () {
        $u = makeUser('student', ['password' => 'Secret12345', 'email_verified_at' => null]);
        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'Secret12345'])->assertForbidden()->assertJsonPath('code', 'unverified');
        $s = makeUser('staff', ['password' => 'Secret12345', 'is_active' => false]);
        $this->postJson('/api/auth/login', ['email' => $s->email, 'password' => 'Secret12345'])->assertForbidden()->assertJsonPath('code', 'inactive');
    });

    it('gives the same error for a wrong password and an unknown email', function () {
        $u = makeUser('student', ['password' => 'Secret12345']);
        $a = $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'wrong'])->assertUnprocessable()->json('errors.email.0');
        $b = $this->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])->assertUnprocessable()->json('errors.email.0');
        expect($a)->toBe($b);
    });

    it('requires an emailed code for staff, Head and President, and never returns a token before it', function (string $role) {
        $u = makeUser($role, ['password' => 'Secret12345']);
        $res = $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'Secret12345'])->assertOk()->assertJsonPath('otp_required', true);
        expect($res->json('token'))->toBeNull();
        expect(DB::table('email_log')->where('type', 'otp')->count())->toBe(1);
    })->with(['staff', 'head', 'president']);

    it('accepts the right code once, and locks after too many wrong codes', function () {
        Notification::fake();
        $u = makeUser('staff', ['password' => 'Secret12345']);
        $challenge = $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'Secret12345'])->json('challenge');
        $code = null;
        Notification::assertSentOnDemand(IdentityMail::class, function ($n) use (&$code, $u) {
            $code = (string) preg_replace('/\D/', '', $n->toMail($u)->subject);

            return true;
        });

        $this->postJson('/api/auth/otp', ['challenge' => $challenge, 'code' => $code])->assertOk()->assertJsonStructure(['token']);
        $this->postJson('/api/auth/otp', ['challenge' => $challenge, 'code' => $code])->assertUnprocessable(); // single use

        $challenge2 = $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'Secret12345'])->json('challenge');
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/auth/otp', ['challenge' => $challenge2, 'code' => '000000']);
        }
        $this->postJson('/api/auth/otp', ['challenge' => $challenge2, 'code' => '000000'])->assertUnprocessable();
        expect(OtpCode::whereNotNull('consumed_at')->count())->toBeGreaterThanOrEqual(2);
    });

    it('rate-limits repeated login attempts', function () {
        $u = makeUser('student', ['password' => 'Secret12345']);
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'bad']);
        }
        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'bad'])->assertStatus(429);
    });
});

describe('FR-A7 role gates', function () {
    it('returns the current user and blocks anonymous requests', function () {
        $this->getJson('/api/auth/me')->assertUnauthorized();
        actingAsRole('student');
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.role', 'student');
    });

    it('allows only the Head to manage staff accounts', function (string $role, int $status) {
        actingAsRole($role);
        $this->getJson('/api/staff/accounts')->assertStatus($status);
    })->with([['student', 403], ['staff', 403], ['president', 403], ['head', 200]]);

    it('refuses a deactivated user even with a valid token', function () {
        $u = makeUser('staff', ['is_active' => false]);
        Sanctum::actingAs($u);
        $this->getJson('/api/auth/me')->assertUnauthorized();
    });
});

describe('FR-A4/A8 invitations and deactivation', function () {
    it('lets the Head invite staff and the invitee set a password', function () {
        Notification::fake();
        actingAsRole('head');
        $this->postJson('/api/staff/invitations', ['name' => 'Kojo', 'email' => 'Kojo@Careers.example', 'role' => 'staff'])->assertCreated();

        $token = null;
        Notification::assertSentOnDemand(IdentityMail::class, function ($n) use (&$token) {
            preg_match('/token=([A-Za-z0-9]+)/', $n->toMail(new stdClass)->actionUrl, $m);
            $token = $m[1] ?? null;

            return true;
        });
        $this->postJson('/api/auth/accept-invite', ['token' => $token, 'password' => 'Secret12345', 'password_confirmation' => 'Secret12345'])->assertOk();
        $u = User::where('email', 'kojo@careers.example')->first();
        expect($u->role)->toBe('staff')->and($u->email_verified_at)->not->toBeNull();
        $this->postJson('/api/auth/accept-invite', ['token' => $token, 'password' => 'Secret12345', 'password_confirmation' => 'Secret12345'])->assertUnprocessable();
        expect(DB::table('audit_log')->where('action', 'staff.invited')->exists())->toBeTrue();
    });

    it('rejects expired invitations and student addresses', function () {
        actingAsRole('head');
        $this->postJson('/api/staff/invitations', ['name' => 'S', 'email' => studentEmail('s'), 'role' => 'staff'])->assertUnprocessable();
        $raw = str_repeat('a', 64);
        Invitation::create(['email' => 'old@careers.example', 'name' => 'Old', 'role' => 'staff', 'token_hash' => hash('sha256', $raw),
            'expires_at' => now()->subDay(), 'invited_by' => User::first()->id]);
        $this->postJson('/api/auth/accept-invite', ['token' => $raw, 'password' => 'Secret12345', 'password_confirmation' => 'Secret12345'])->assertUnprocessable();
    });

    it('deactivates a staff member and revokes their tokens, but not yourself', function () {
        $head = actingAsRole('head');
        $staff = makeUser('staff');
        $staff->createToken('web');
        $this->patchJson("/api/staff/accounts/{$staff->id}", ['is_active' => false])->assertOk();
        expect($staff->fresh()->is_active)->toBeFalse()->and($staff->tokens()->count())->toBe(0);
        $this->patchJson("/api/staff/accounts/{$head->id}", ['is_active' => false])->assertUnprocessable();
        expect(DB::table('audit_log')->where('action', 'staff.deactivated')->exists())->toBeTrue();
    });

    it('audit log rows cannot be changed', function () {
        DB::table('audit_log')->insert(['action' => 'x', 'created_at' => now()]);
        expect(fn () => DB::table('audit_log')->update(['action' => 'y']))->toThrow(QueryException::class);
    });
});

describe('FR-A6 password reset', function () {
    it('answers the same for unknown emails and resets with a valid token', function () {
        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();
        $u = makeUser('student', ['password' => 'Secret12345']);
        $u->createToken('web');
        $token = Password::createToken($u);
        $this->postJson('/api/auth/reset-password', ['token' => $token, 'email' => $u->email, 'password' => 'NewSecret123', 'password_confirmation' => 'NewSecret123'])->assertOk();
        expect($u->fresh()->tokens()->count())->toBe(0);
        $this->postJson('/api/auth/login', ['email' => $u->email, 'password' => 'NewSecret123'])->assertOk();
    });
});
