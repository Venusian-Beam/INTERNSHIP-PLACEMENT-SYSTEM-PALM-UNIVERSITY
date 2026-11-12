#!/bin/sh
set -e

# Discover packages and cache routes
php artisan package:discover --ansi || true
php artisan config:cache || true
php artisan route:cache || true

# Run database migrations
php artisan migrate --force || true

# Start FrankenPHP
exec "$@"
