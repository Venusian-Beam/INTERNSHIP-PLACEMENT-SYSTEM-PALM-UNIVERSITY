<?php

use Illuminate\Support\Facades\Route;

/**
 * Security regression guard: every API route must require a signed-in user and a role gate,
 * except this explicit list of public identity endpoints. A new route that forgets auth fails CI.
 */
const PUBLIC_API = ['api/auth/register', 'api/auth/email/resend', 'api/auth/verify-email/{id}/{hash}', 'api/auth/login', 'api/auth/otp',
    'api/auth/forgot-password', 'api/auth/reset-password', 'api/auth/accept-invite'];

it('requires authentication and a role gate on every non-public API route', function () {
    $unprotected = [];
    foreach (Route::getRoutes() as $route) {
        $uri = $route->uri();
        if (! str_starts_with($uri, 'api/') || in_array($uri, PUBLIC_API, true)) {
            continue;
        }
        $mw = $route->gatherMiddleware();
        $hasAuth = in_array('auth:sanctum', $mw, true);
        $hasRole = (bool) array_filter($mw, fn ($m) => is_string($m) && str_starts_with($m, 'role'));
        if (! $hasAuth || ! $hasRole) {
            $unprotected[] = implode('|', $route->methods()).' '.$uri;
        }
    }
    expect($unprotected)->toBe([]);
});

it('public identity endpoints are rate limited', function () {
    foreach (Route::getRoutes() as $route) {
        if (in_array($route->uri(), PUBLIC_API, true)) {
            expect(collect($route->gatherMiddleware())->contains(fn ($m) => str_starts_with((string) $m, 'throttle:')))->toBeTrue($route->uri());
        }
    }
});

it('anonymous requests to protected routes are refused', function (string $method, string $uri) {
    $this->json($method, $uri)->assertUnauthorized();
})->with([
    ['GET', '/api/students'], ['GET', '/api/dashboard'], ['GET', '/api/letters/workspace'], ['POST', '/api/letters/generate'],
    ['GET', '/api/audit'], ['GET', '/api/president/template'], ['GET', '/api/student/application'], ['POST', '/api/files/uploads'],
    ['GET', '/api/reports/graduation'], ['POST', '/api/registry/import'],
]);
