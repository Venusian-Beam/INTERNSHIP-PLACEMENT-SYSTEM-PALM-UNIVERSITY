<?php

namespace App\Modules\Identity\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OtpCode extends Model
{
    protected $fillable = ['user_id', 'challenge_hash', 'code_hash', 'expires_at', 'consumed_at', 'attempts'];

    protected $hidden = ['challenge_hash', 'code_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'consumed_at' => 'datetime', 'attempts' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
