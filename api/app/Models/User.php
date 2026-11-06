<?php

namespace App\Models;

use App\Modules\Students\Models\StudentProfile;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLES = ['student', 'staff', 'head', 'president'];

    public const PRIVILEGED = ['staff', 'head', 'president']; // AD15: login code required

    protected $fillable = ['name', 'email', 'password', 'role', 'is_active', 'privacy_accepted_at', 'email_verified_at'];

    protected $hidden = ['password', 'remember_token'];

    /** Mirror the database defaults so freshly created models behave the same as loaded ones. */
    protected $attributes = ['role' => 'student', 'is_active' => true];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'privacy_accepted_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
        ];
    }

    /** Emails are stored lower-case so uniqueness and lookups are case-insensitive. */
    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value) => strtolower(trim($value)));
    }

    public function studentProfile(): HasOne
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function isStudent(): bool
    {
        return $this->role === 'student';
    }

    public function isHead(): bool
    {
        return $this->role === 'head';
    }

    public function isPresident(): bool
    {
        return $this->role === 'president';
    }

    /** Career Services staff powers (Head has all of them too, D5). */
    public function isCareerServices(): bool
    {
        return in_array($this->role, ['staff', 'head'], true);
    }

    public function needsLoginCode(): bool
    {
        return in_array($this->role, self::PRIVILEGED, true);
    }
}
