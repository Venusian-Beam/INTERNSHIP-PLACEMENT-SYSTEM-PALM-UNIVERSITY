<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Insert-only audit trail of sensitive actions (AD16, FR-X1).
 * The audit_log table rejects UPDATE/DELETE at the database level.
 */
class Audit
{
    public static function log(string $action, ?Model $subject = null, array $metadata = [], ?User $actor = null): void
    {
        $request = request();
        DB::table('audit_log')->insert([
            'actor_user_id' => ($actor ?? $request?->user())?->id,
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'metadata' => $metadata ? json_encode($metadata) : null,
            'ip' => $request?->ip(),
            'created_at' => now(),
        ]);
    }
}
