<?php

use Illuminate\Support\Facades\Route;

beforeEach(function () {
    config(['placement.bff_key' => 'test-bff-key']);
    Route::middleware('api')->get('/api/_ip', fn () => ['ip' => request()->ip()]);
});

it('refuses API calls that do not come from the Next.js server', function () {
    $this->postJson('/api/auth/login', ['email' => 'a@b.c', 'password' => 'x'])->assertNotFound();
    $this->postJson('/api/auth/login', ['email' => 'a@b.c', 'password' => 'x'], ['X-BFF-Key' => 'wrong'])->assertNotFound();
});

it('accepts the BFF and uses the client IP it forwards', function () {
    $this->getJson('/api/_ip', ['X-BFF-Key' => 'test-bff-key', 'X-Client-IP' => '41.66.1.2'])->assertOk()->assertJsonPath('ip', '41.66.1.2');
});

it('ignores a forwarded client IP without the key (no spoofing)', function () {
    $this->getJson('/api/_ip', ['X-Client-IP' => '41.66.1.2'])->assertNotFound();
});

it('still lets the emailed verification link through directly', function () {
    $this->get('/api/auth/verify-email/1/abc')->assertRedirectContains('verified=invalid');
});
