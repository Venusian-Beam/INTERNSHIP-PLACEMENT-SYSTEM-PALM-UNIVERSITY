<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// On Vercel the API is served under /backend (vercel.json rewrite). Caddy's handle_path strips it only for
// file lookup; PHP still sees the original REQUEST_URI, so strip it here or every route 404s.
$uri = $_SERVER['REQUEST_URI'] ?? '';
if ($uri === '/backend' || str_starts_with($uri, '/backend/') || str_starts_with($uri, '/backend?')) {
    $_SERVER['REQUEST_URI'] = '/'.ltrim(substr($uri, strlen('/backend')), '/');
}

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
