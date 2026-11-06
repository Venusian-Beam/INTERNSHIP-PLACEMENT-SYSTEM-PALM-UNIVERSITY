<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('student:create-fresh', function () {
    $domain = config('placement.student_email_domain', 'st.university.example');
    $email = "demo.student@{$domain}";
    $password = 'Placement2026!';
    $name = 'Kweku Mensah';

    // Delete if already exists to ensure it has never applied
    $existing = \App\Models\User::where('email', $email)->first();
    if ($existing) {
        if ($existing->studentProfile) {
            foreach ($existing->studentProfile->applications as $app) {
                $app->choices()->delete();
                $app->placements()->delete();
                $app->delete();
            }
            $existing->studentProfile->delete();
        }
        $existing->delete();
    }

    $user = \App\Models\User::create([
        'name' => $name,
        'email' => $email,
        'password' => $password,
        'role' => 'student',
        'is_active' => true,
        'email_verified_at' => now(),
        'privacy_accepted_at' => now(),
    ]);

    $profile = \App\Modules\Students\Models\StudentProfile::create([
        'user_id' => $user->id,
        'university_email' => $email,
        'full_name' => $name,
        'student_number' => '10293847',
        'programme' => 'Computer Science',
        'level' => 300,
        'phone' => '024 123 4567',
        'on_registry' => true,
        'expected_grad_year' => 2028,
        'cv_file_id' => null,
    ]);

    $this->info("Student account created successfully!");
    $this->line("Email: {$email}");
    $this->line("Password: {$password}");
    $this->line("Name: {$name}");
    $this->line("Applications: 0 (Fresh / Unapplied)");
})->purpose('Create a fresh student account with no applications');
