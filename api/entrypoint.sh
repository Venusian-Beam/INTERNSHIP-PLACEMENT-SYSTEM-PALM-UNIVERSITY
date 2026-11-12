#!/bin/sh
set -e

# Run database migrations
php artisan migrate --force || true

# Start FrankenPHP
exec "$@"
