<?php

namespace App\Modules\Students\Models;

use App\Models\User;
use App\Modules\Applications\Models\Application;
use App\Modules\Files\Models\StoredFile;
use App\Modules\Placements\Models\Placement;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudentProfile extends Model
{
    protected $fillable = ['user_id', 'university_email', 'full_name', 'student_number', 'programme', 'level', 'phone',
        'expected_grad_year', 'on_registry', 'cv_file_id'];

    protected function casts(): array
    {
        return ['on_registry' => 'boolean', 'level' => 'integer', 'expected_grad_year' => 'integer', 'documents_purged_at' => 'datetime'];
    }

    protected function universityEmail(): Attribute
    {
        return Attribute::make(set: fn (string $v) => strtolower(trim($v)));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function cv(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'cv_file_id');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    public function placements(): HasMany
    {
        return $this->hasMany(Placement::class);
    }

    /** A1: expected graduation year from the registry, else derived from level (4-year programmes assumed). */
    public static function deriveGradYear(?int $level, ?int $fromYear = null): ?int
    {
        if (! $level || $level < 100) {
            return null;
        }
        $year = $fromYear ?? (int) now()->format('Y');

        return $year + max(0, 4 - intdiv($level, 100));
    }
}
