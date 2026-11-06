<?php

namespace App\Modules\Placements\Models;

use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\Models\StoredFile;
use App\Modules\Letters\Models\Letter;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Students\Models\StudentProfile;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Placement extends Model
{
    protected $fillable = ['application_id', 'student_profile_id', 'organisation_id', 'cycle_id', 'letter_id', 'status',
        'reply_recorded_by', 'reply_recorded_at', 'acceptance_file_id', 'acceptance_confirmed_by', 'acceptance_confirmed_at',
        'report_file_id', 'evaluation_file_id', 'completed_by', 'completed_at'];

    protected function casts(): array
    {
        return ['reply_recorded_at' => 'datetime', 'acceptance_confirmed_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(StudentProfile::class, 'student_profile_id');
    }

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(Cycle::class);
    }

    public function letter(): BelongsTo
    {
        return $this->belongsTo(Letter::class);
    }

    public function acceptanceFile(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'acceptance_file_id');
    }

    public function reportFile(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'report_file_id');
    }

    public function evaluationFile(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'evaluation_file_id');
    }
}
