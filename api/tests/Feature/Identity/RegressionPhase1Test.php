<?php

use App\Models\User;
use App\Modules\Identity\Models\OtpCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/** Regression tests for Phase 1 QA defects. */
it('QA-1-02: a login code claimed by a parallel request cannot be used again', function () {
    $u = makeUser('staff');
    $challenge = str_repeat('c', 48);
    $otp = OtpCode::create(['user_id' => $u->id, 'challenge_hash' => hash('sha256', $challenge), 'code_hash' => Hash::make('123456'),
        'expires_at' => now()->addMinutes(10)]);

    // Simulate the race: another request consumes the code after this one has loaded it but before it claims it.
    OtpCode::retrieved(function (OtpCode $loaded) use ($otp) {
        if ($loaded->id === $otp->id) {
            OtpCode::whereKey($otp->id)->getQuery()->update(['consumed_at' => now()]);
        }
    });

    $this->postJson('/api/auth/otp', ['challenge' => $challenge, 'code' => '123456'])->assertUnprocessable();
    expect($u->tokens()->count())->toBe(0);
});

it('QA-1-03: a duplicate registration that loses a race answers like success, not 500', function () {
    $email = 'race@'.config('placement.student_email_domain');
    // Simulate the race: the row appears between the "exists" check and the insert.
    User::creating(function ($user) use ($email) {
        if ($user->email === $email && ! User::where('email', $email)->exists()) {
            DB::table('users')->insert(['name' => 'Winner', 'email' => $email, 'password' => 'x', 'role' => 'student',
                'created_at' => now(), 'updated_at' => now()]);
        }
    });

    $this->postJson('/api/auth/register', ['name' => 'Loser', 'email' => $email, 'password' => 'Secret12345',
        'password_confirmation' => 'Secret12345', 'privacy_accepted' => true])
        ->assertCreated()->assertJsonPath('message', 'Check your inbox to confirm your email address.');
    // (The simulated winner row lives in the same rolled-back transaction here; in a real race it is committed separately.)
});
