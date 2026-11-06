<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * AD8 hardening. The API is meant to be called only by the Next.js server (backend-for-frontend).
 * - The BFF proves itself with a shared key (X-BFF-Key). Without it, API calls are refused, except the
 *   emailed verification link and secret-protected cron endpoints, which arrive directly.
 * - Only a request carrying the valid key may set the client IP (X-Client-IP), so per-IP rate limits apply
 *   to the real user instead of the Next.js server, and nobody else can spoof their IP.
 * When BFF_SHARED_KEY is empty (tests, local tools) the check is skipped.
 */
class TrustBff
{
    private const DIRECT_ROUTES = ['verification.verify'];

    public function handle(Request $request, Closure $next): Response
    {
        $key = (string) config('placement.bff_key');
        if ($key === '') {
            return $next($request);
        }

        $fromBff = hash_equals($key, (string) $request->header('X-BFF-Key'));
        if ($fromBff) {
            $ip = (string) $request->header('X-Client-IP');
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                $request->server->set('REMOTE_ADDR', $ip);
            }

            return $next($request);
        }

        $name = $request->route()?->getName();
        if (in_array($name, self::DIRECT_ROUTES, true) || str_starts_with((string) $name, 'cron.')) {
            return $next($request);
        }

        return response()->json(['message' => 'Not found.'], 404);
    }
}
