<?php

namespace App\Modules\Letters\Models;

use App\Models\User;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\Models\StoredFile;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Letter extends Model
{
    protected $fillable = ['reference_no', 'cycle_id', 'organisation_id', 'template_id', 'issue_date', 'period_start', 'period_end',
        'status', 'send_mode', 'recipient_email', 'addressee_snapshot', 'pdf_file_id', 'sent_by', 'sent_at', 'failure_reason'];

    protected function casts(): array
    {
        return ['issue_date' => 'date', 'period_start' => 'date', 'period_end' => 'date', 'sent_at' => 'datetime', 'addressee_snapshot' => 'array'];
    }

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(Cycle::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(LetterTemplate::class, 'template_id');
    }

    public function pdf(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'pdf_file_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function placements(): HasMany
    {
        return $this->hasMany(Placement::class);
    }

    public function isSent(): bool
    {
        return $this->status === 'sent';
    }
}
