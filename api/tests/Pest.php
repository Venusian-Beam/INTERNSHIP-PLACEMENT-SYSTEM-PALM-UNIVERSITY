<?php

use App\Models\User;
use App\Modules\Students\Models\StudentProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');

/** Create a user of a given role (students get a profile with a university email). */
function makeUser(string $role = 'student', array $attrs = []): User
{
    $email = $attrs['email'] ?? ($role === 'student'
        ? fake()->unique()->userName().'@'.config('placement.student_email_domain')
        : fake()->unique()->userName().'@careers.example');
    $user = User::factory()->create(array_merge(['role' => $role, 'email' => $email, 'privacy_accepted_at' => now()], $attrs));
    if ($role === 'student') {
        StudentProfile::create(['user_id' => $user->id, 'university_email' => $user->email, 'full_name' => $user->name,
            'programme' => 'Computer Science', 'level' => 300]);
    }

    return $user;
}

/** Act as a user through Sanctum (API token auth). */
function actingAsRole(string $role = 'student', array $attrs = []): User
{
    $user = makeUser($role, $attrs);
    Sanctum::actingAs($user);

    return $user;
}
