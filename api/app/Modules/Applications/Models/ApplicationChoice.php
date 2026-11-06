<?php

namespace App\Modules\Applications\Models;

use App\Modules\Organisations\Models\Organisation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationChoice extends Model
{
    protected $fillable = ['application_id', 'rank', 'organisation_id'];

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
