<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route-level role gate: `role:staff,head`. Deactivated accounts are refused even if a token survives.
 * Record-level rules (ownership etc.) are still enforced by Policies.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        if (! $user || ! $user->is_active) {
            abort(401, 'Unauthenticated.');
        }
        if ($roles && ! in_array($user->role, $roles, true)) {
            abort(403, 'You do not have access to this area.');
        }

        return $next($request);
    }
}
