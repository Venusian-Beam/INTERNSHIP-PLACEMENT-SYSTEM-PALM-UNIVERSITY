<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** SEC-02 hardening: defensive headers on every API response (no sniffing, no framing, no referrer, no caching). */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('Cache-Control', 'no-store, private'); // personal data: never written to caches
        $response->headers->remove('X-Powered-By');

        return $response;
    }
}
