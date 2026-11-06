<?php

namespace App\Modules\Files\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Metadata for a private object in storage (AD6). The bytes never pass through the API. */
class StoredFile extends Model
{
    protected $table = 'files';

    protected $fillable = ['kind', 'storage_key', 'original_name', 'mime', 'size_bytes', 'status', 'uploaded_by'];

    protected $hidden = ['storage_key'];

    protected function casts(): array
    {
        return ['size_bytes' => 'integer', 'deleted_at' => 'datetime'];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
