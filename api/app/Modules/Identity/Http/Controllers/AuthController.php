<?php

namespace App\Modules\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Identity\Models\Invitation;
use App\Modules\Identity\Models\OtpCode;
use App\Modules\Identity\Notifications\IdentityMail;
use App\Modules\Students\Models\StudentProfile;
use App\Support\Audit;
use App\Support\Outbox;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/** FR-A1–A6: registration, verification, login with login code, logout, me, password reset, invite acceptance. */
class AuthController extends Controller
{
    private const GENERIC_LOGIN_ERROR = 'These credentials do not match our records.';

    /** FR-A1/A2/A3: student self-registration, university domain only, privacy consent, linked to registry record. */
    public function register(Request $request): JsonResponse
    {
        $domain = config('placement.student_email_domain');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email:rfc', 'max:190', function ($attr, $value, $fail) use ($domain) {
                if (! str_ends_with(strtolower(trim($value)), '@'.$domain)) {
                    $fail("Use your university email address (ending in @{$domain}).");
                }
            }],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
            'privacy_accepted' => ['accepted'],
        ]);
        $email = strtolower(trim($data['email']));

        if (User::where('email', $email)->exists()) {
            // Same response as success: no account enumeration. The owner can sign in or reset their password.
            return response()->json(['message' => 'Check your inbox to confirm your email address.'], 201);
        }

        try {
            $user = $this->createStudent($data, $email);
        } catch (UniqueConstraintViolationException) {
            // QA-1-03: a parallel registration won the race; answer exactly like success (no enumeration, no 500).
            return response()->json(['message' => 'Check your inbox to confirm your email address.'], 201);
        }

        $this->sendVerification($user);

        return response()->json(['message' => 'Check your inbox to confirm your email address.'], 201);
    }

    private function createStudent(array $data, string $email): User
    {
        return DB::transaction(function () use ($data, $email) {
            $user = User::create([
                'name' => $data['name'], 'email' => $email, 'password' => $data['password'],
                'role' => 'student', 'privacy_accepted_at' => now(),
            ]);
            // D31: link to the imported registry record when one exists, else create the profile.
            $profile = StudentProfile::where('university_email', $email)->whereNull('user_id')->lockForUpdate()->first();
            if ($profile) {
                $profile->update(['user_id' => $user->id]);
            } else {
                StudentProfile::create(['user_id' => $user->id, 'university_email' => $email, 'full_name' => $data['name'], 'on_registry' => false]);
            }

            return $user;
        });
    }

    /** Signed link from the verification email. Redirects to the web sign-in page with the result. */
    public function verifyEmail(Request $request, int $id, string $hash): RedirectResponse
    {
        $front = config('placement.frontend_url').'/sign-in';
        $user = User::find($id);
        if (! $request->hasValidSignature() || ! $user || ! hash_equals(sha1($user->email), $hash)) {
            return redirect()->away($front.'?verified=invalid');
        }
        if (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return redirect()->away($front.'?verified=1');
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        $user = User::where('email', strtolower(trim($request->input('email'))))->where('role', 'student')->first();
        if ($user && ! $user->email_verified_at) {
            $this->sendVerification($user);
        }

        return response()->json(['message' => 'If that account needs confirming, a new link is on its way.']);
    }

    /** FR-A5: password, then (for staff, Head, President) an emailed one-time code. */
    /** Name given to a session token that was ended because the account signed in on another device. */
    public const REPLACED_TOKEN = 'replaced';

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::where('email', strtolower(trim($data['email'])))->first();

        // Always run a hash check so response time doesn't reveal whether the account exists.
        $ok = Hash::check($data['password'], $user?->password ?? '$2y$12$'.str_repeat('x', 53));
        if (! $user || ! $ok) {
            throw ValidationException::withMessages(['email' => self::GENERIC_LOGIN_ERROR]);
        }
        if (! $user->is_active) {
            return response()->json(['message' => 'This account is deactivated. Contact Career Services.', 'code' => 'inactive'], 403);
        }
        if (! $user->email_verified_at) {
            return response()->json(['message' => 'Confirm your email first. Check your inbox for the link.', 'code' => 'unverified'], 403);
        }

        if ($user->needsLoginCode()) {
            // SEC-05: someone who knows the password can request fresh codes; cap wrong guesses and codes per day.
            $recent = OtpCode::where('user_id', $user->id)->where('created_at', '>', now()->subDay());
            if ((clone $recent)->sum('attempts') >= 15 || (clone $recent)->count() >= 30) {
                return response()->json(['message' => 'Too many sign-in attempts for this account today. Try again tomorrow or reset your password.', 'code' => 'otp_locked'], 429);
            }
            $challenge = Str::random(48);
            $code = (string) random_int(10 ** (config('placement.otp.digits') - 1), 10 ** config('placement.otp.digits') - 1);
            OtpCode::where('user_id', $user->id)->whereNull('consumed_at')->update(['consumed_at' => now()]); // one live code at a time
            OtpCode::create([
                'user_id' => $user->id, 'challenge_hash' => hash('sha256', $challenge), 'code_hash' => Hash::make($code),
                'expires_at' => now()->addMinutes(config('placement.otp.ttl_minutes')),
            ]);
            Outbox::send($user->email, IdentityMail::loginCode($user->name, $code, config('placement.otp.ttl_minutes')), 'otp', $user->id);

            $body = ['otp_required' => true, 'challenge' => $challenge];
            if (config('placement.expose_login_codes')) {
                $body['dev_code'] = $code; // temporary testing aid, see config/placement.php
            }

            return response()->json($body);
        }

        return $this->issueToken($user);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate(['challenge' => ['required', 'string', 'size:48'], 'code' => ['required', 'digits:'.config('placement.otp.digits')]]);
        $otp = OtpCode::where('challenge_hash', hash('sha256', $data['challenge']))->first();

        $fail = fn (string $msg) => throw ValidationException::withMessages(['code' => $msg]);
        if (! $otp || $otp->consumed_at || $otp->expires_at->isPast()) {
            $fail('This code has expired. Sign in again to get a new one.');
        }
        if ($otp->attempts >= config('placement.otp.max_attempts')) {
            $otp->update(['consumed_at' => now()]);
            $fail('Too many attempts. Sign in again to get a new code.');
        }
        if (! Hash::check($data['code'], $otp->code_hash)) {
            $otp->increment('attempts');
            $fail('That code is not correct.');
        }

        // QA-1-02: claim the code atomically so two simultaneous requests can't both use it.
        $claimed = OtpCode::whereKey($otp->id)->whereNull('consumed_at')->update(['consumed_at' => now()]);
        if ($claimed !== 1) {
            $fail('This code has already been used. Sign in again to get a new one.');
        }
        $user = $otp->user;
        if (! $user->is_active) {
            return response()->json(['message' => 'This account is deactivated.'], 403);
        }

        return $this->issueToken($user);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    public function me(Request $request): JsonResponse
    {
        // The current cycle's name rides along so the web header needs no second request.
        return response()->json(['user' => self::present($request->user()), 'cycle' => Cycle::current()?->only(['id', 'name'])]);
    }

    /** FR-A6: always the same answer, whether or not the account exists. */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => strtolower(trim($request->input('email')))]);

        return response()->json(['message' => 'If an account exists for that email, a reset link is on its way.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'], 'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);
        $status = Password::reset(
            ['email' => strtolower(trim($request->input('email'))), 'password' => $request->input('password'),
                'password_confirmation' => $request->input('password_confirmation'), 'token' => $request->input('token')],
            function (User $user, string $password) {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                $user->tokens()->delete(); // sign out everywhere
            }
        );
        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This reset link is invalid or has expired.']);
        }

        return response()->json(['message' => 'Password changed. You can sign in now.']);
    }

    /** FR-A4: an invited staff/Head/President sets a password. No token is returned: they sign in normally. */
    public function acceptInvite(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'size:64'], 'password' => ['required', 'confirmed', PasswordRule::defaults()]]);
        $invite = Invitation::where('token_hash', hash('sha256', $data['token']))->first();
        if (! $invite || ! $invite->isUsable()) {
            throw ValidationException::withMessages(['token' => 'This invitation is invalid or has expired. Ask the Head of Career Services for a new one.']);
        }
        if (User::where('email', $invite->email)->exists()) {
            throw ValidationException::withMessages(['token' => 'An account already exists for this email.']);
        }

        $user = DB::transaction(function () use ($invite, $data) {
            $user = User::create([
                'name' => $invite->name, 'email' => $invite->email, 'password' => $data['password'], 'role' => $invite->role,
                'email_verified_at' => now(), 'privacy_accepted_at' => now(),
            ]);
            $invite->update(['accepted_at' => now()]);

            return $user;
        });
        Audit::log('staff.joined', $user, ['role' => $user->role], $user);

        return response()->json(['message' => 'Account ready. Sign in with your new password.']);
    }

    private function issueToken(User $user): JsonResponse
    {
        $user->forceFill(['last_login_at' => now()])->save();

        // One device at a time: signing in ends every other session for this account. The old tokens are kept
        // (expired, renamed "replaced") for a day so the other device is told why it was signed out (bootstrap/app.php).
        $user->tokens()->where('name', self::REPLACED_TOKEN)->where('updated_at', '<', now()->subDay())->delete();
        $user->tokens()->where('name', 'web')->update(['name' => self::REPLACED_TOKEN, 'expires_at' => now(), 'updated_at' => now()]);

        $token = $user->createToken('web', ['*'], now()->addMinutes((int) config('sanctum.expiration')))->plainTextToken;

        // The Next.js server stores this in an HttpOnly cookie; it never reaches browser JavaScript (AD8).
        return response()->json(['token' => $token, 'user' => self::present($user)]);
    }

    private function sendVerification(User $user): void
    {
        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), ['id' => $user->id, 'hash' => sha1($user->email)]);
        Outbox::send($user->email, IdentityMail::verify($user->name, $url), 'verify', $user->id);
    }

    public static function present(User $user): array
    {
        $profile = $user->isStudent() ? $user->studentProfile : null;

        return [
            'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role,
            'profile' => $profile ? [
                'id' => $profile->id, 'full_name' => $profile->full_name, 'programme' => $profile->programme,
                'level' => $profile->level, 'student_number' => $profile->student_number, 'phone' => $profile->phone,
                'on_registry' => $profile->on_registry, 'has_cv' => (bool) $profile->cv_file_id, 'cv_file_id' => $profile->cv_file_id,
            ] : null,
        ];
    }
}
