<?php

namespace App\Modules\Organisations\Models;

use App\Models\User;
use App\Modules\Students\Models\StudentProfile;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Organisation extends Model
{
    protected $fillable = ['name', 'address', 'email', 'contact_person', 'contact_title', 'phone', 'sector', 'status',
        'rejection_reason', 'merged_into_id', 'proposed_by_student_id', 'checked_by', 'checked_at'];

    protected function casts(): array
    {
        return ['checked_at' => 'datetime'];
    }

    public function proposer(): BelongsTo
    {
        return $this->belongsTo(StudentProfile::class, 'proposed_by_student_id');
    }

    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }

    public function mergedInto(): BelongsTo
    {
        return $this->belongsTo(self::class, 'merged_into_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
