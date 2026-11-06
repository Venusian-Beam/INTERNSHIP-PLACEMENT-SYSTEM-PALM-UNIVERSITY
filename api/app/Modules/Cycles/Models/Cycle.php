<?php

namespace App\Modules\Cycles\Models;

use Illuminate\Database\Eloquent\Model;

class Cycle extends Model
{
    protected $fillable = ['name', 'applications_open_at', 'applications_close_at', 'letter_cutoff_at', 'default_period_start', 'default_period_end'];

    protected function casts(): array
    {
        return [
            'applications_open_at' => 'datetime', 'applications_close_at' => 'datetime', 'letter_cutoff_at' => 'datetime',
            'default_period_start' => 'date', 'default_period_end' => 'date',
        ];
    }

    /** BR1 */
    public function isOpenForApplications(): bool
    {
        return now()->between($this->applications_open_at, $this->applications_close_at);
    }

    /** BR5 / D20 */
    public function isPastCutoff(): bool
    {
        return now()->greaterThan($this->letter_cutoff_at);
    }

    /** The cycle people work in: the latest one that has opened (else the earliest upcoming one). */
    public static function current(): ?self
    {
        return static::where('applications_open_at', '<=', now())->orderByDesc('applications_open_at')->first()
            ?? static::orderBy('applications_open_at')->first();
    }
}
