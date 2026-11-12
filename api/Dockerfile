FROM dunglas/frankenphp:1-php8.4

# Install PostgreSQL and recommended Laravel extensions
RUN install-php-extensions \
    pdo_pgsql \
    pgsql \
    opcache \
    intl \
    zip \
    gd \
    bcmath

# Copy application files
COPY . /app

WORKDIR /app

# Install production dependencies with Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Set up storage and cache permissions
RUN mkdir -p /app/storage/framework/cache /app/storage/framework/sessions /app/storage/framework/views /app/bootstrap/cache \
    && chmod -R 777 /app/storage /app/bootstrap/cache \
    && chmod +x /app/entrypoint.sh

ENV PORT=80
EXPOSE 80

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["frankenphp", "run", "--config", "/app/Caddyfile"]
