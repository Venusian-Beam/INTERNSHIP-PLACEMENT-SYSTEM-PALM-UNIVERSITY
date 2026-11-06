<?php

namespace App\Modules\Letters\Models;

use App\Models\User;
use App\Modules\Files\Models\StoredFile;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LetterTemplate extends Model
{
    protected $fillable = ['version', 'body', 'format', 'source_file_id', 'status', 'created_by', 'submitted_by', 'submitted_at', 'decided_by', 'decided_at', 'remarks'];

    protected $attributes = ['format' => 'text'];

    public function sourceFile(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'source_file_id');
    }

    protected function casts(): array
    {
        return ['submitted_at' => 'datetime', 'decided_at' => 'datetime', 'version' => 'integer'];
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    /** BR4: the version every new letter uses. */
    public static function approved(): ?self
    {
        return static::where('status', 'approved')->first();
    }
}
