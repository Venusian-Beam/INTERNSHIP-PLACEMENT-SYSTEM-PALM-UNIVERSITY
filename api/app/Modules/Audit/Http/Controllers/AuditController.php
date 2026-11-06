<?php

namespace App\Modules\Audit\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** H5 (proposed: Head only): read-only view of the insert-only audit trail (AD16, FR-X1). */
class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::table('audit_log as a')->leftJoin('users as u', 'u.id', '=', 'a.actor_user_id')
            ->orderByDesc('a.id')->select(['a.id', 'a.action', 'a.subject_type', 'a.subject_id', 'a.metadata', 'a.ip', 'a.created_at', 'u.name as actor', 'u.role as actor_role']);
        if ($request->filled('action')) {
            $q->where('a.action', 'like', addcslashes((string) $request->input('action'), '%_\\').'%');
        }

        return response()->json([
            'entries' => $q->limit(300)->get()->map(fn ($r) => (array) $r + ['metadata' => $r->metadata ? json_decode($r->metadata, true) : null]),
            'actions' => DB::table('audit_log')->distinct()->orderBy('action')->pluck('action'),
        ]);
    }
}
