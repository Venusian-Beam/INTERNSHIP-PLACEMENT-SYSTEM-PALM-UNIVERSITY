<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\TrustBff;
use App\Modules\Identity\Http\Controllers\AuthController;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['role' => EnsureRole::class]);
        $middleware->api(prepend: [TrustBff::class, SecurityHeaders::class]);
        $middleware->throttleApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // One device at a time (AuthController::issueToken): tell a device whose session was replaced why it got a 401.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            $bearer = (string) $request->bearerToken();
            $replaced = false;
            if (str_contains($bearer, '|')) {
                [$id, $plain] = explode('|', $bearer, 2);
                $token = ctype_digit($id) ? PersonalAccessToken::find($id) : null;
                $replaced = $token && $token->name === AuthController::REPLACED_TOKEN && hash_equals($token->token, hash('sha256', $plain));
            }

            return response()->json($replaced
                ? ['message' => 'You were signed out because your account was signed in on another device.', 'code' => 'session_replaced']
                : ['message' => 'Unauthenticated.'], 401);
        });
    })->create();
