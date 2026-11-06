<?php

namespace App\Modules\Applications\Models;

use App\Modules\Cycles\Models\Cycle;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use App\Modules\Students\Models\StudentProfile;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Application extends Model
{
    protected $fillable = ['student_profile_id', 'cycle_id', 'status', 'motivation', 'submitted_at', 'late_admitted_by',
        'interview_date', 'interview_notes', 'matched_organisation_id', 'outcome_recorded_by', 'outcome_recorded_at'];

    protected function casts(): array
    {
        return ['submitted_at' => 'datetime', 'interview_date' => 'date', 'outcome_recorded_at' => 'datetime'];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(StudentProfile::class, 'student_profile_id');
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(Cycle::class);
    }

    public function matchedOrganisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class, 'matched_organisation_id');
    }

    public function choices(): HasMany
    {
        return $this->hasMany(ApplicationChoice::class)->orderBy('rank');
    }

    public function placements(): HasMany
    {
        return $this->hasMany(Placement::class);
    }
}
