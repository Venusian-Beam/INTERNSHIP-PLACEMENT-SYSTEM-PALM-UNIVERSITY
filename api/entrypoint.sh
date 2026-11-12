#!/bin/sh
set -e

# Cache configuration and routes for production
php artisan config:cache || true
php artisan route:cache || true

# Run database migrations
php artisan migrate --force || true

# Start FrankenPHP
exec "$@"
