<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->refuseUnsafeProductionConfig();
        $this->logLocalMail();

        // NFR-S4: brute-force protection on every identity endpoint.
        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinute(5)->by('login-email:'.strtolower((string) $r->input('email'))),
            Limit::perMinute(20)->by('login-ip:'.$r->ip()),
        ]);
        RateLimiter::for('otp', fn (Request $r) => Limit::perMinute(10)->by('otp:'.$r->ip()));
        RateLimiter::for('register', fn (Request $r) => Limit::perMinute(5)->by('register:'.$r->ip()));
        RateLimiter::for('password', fn (Request $r) => Limit::perMinute(5)->by('password:'.$r->ip()));
        RateLimiter::for('uploads', fn (Request $r) => Limit::perHour(20)->by('uploads:'.$r->user()?->id)); // QA-2-01
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(240)->by($r->user()?->id ?: $r->ip()));

        Password::defaults(fn () => Password::min(config('placement.password_min'))->letters()->numbers());

        // Reset links open the Next.js page, not the API.
        $this->resetUrl();
    }

    /**
     * SEC-02: fail closed. In production the app refuses to start if debug output is on (stack traces and SQL
     * would reach browsers through the proxy), if the BFF shared key is missing (TrustBff would accept direct calls),
     * or if the cron secret is unset or still the development value.
     */
    private function refuseUnsafeProductionConfig(): void
    {
        if (! $this->app->isProduction()) {
            return;
        }
        $problems = array_keys(array_filter([
            'APP_DEBUG must be false' => (bool) config('app.debug'),
            'BFF_SHARED_KEY must be set (32+ characters)' => strlen((string) config('placement.bff_key')) < 32,
            'CRON_SECRET must be set to a strong random value' => strlen((string) config('placement.cron_secret')) < 32
                || str_contains((string) config('placement.cron_secret'), 'dev'),
        ]));
        if ($problems) {
            throw new \RuntimeException('Unsafe production configuration: '.implode('; ', $problems).'.');
        }
    }

    private function resetUrl(): void
    {
        ResetPassword::createUrlUsing(fn ($user, string $token) => config('placement.frontend_url')
            .'/reset-password?token='.urlencode($token).'&email='.urlencode($user->email));
    }

    /**
     * Local development only: write every email the system sends to plain files in the project's logs/ folder
     * (LOCAL_LOG_DIR), so the developer can read sign-in codes and messages without opening anything:
     *   logs/otp-codes.log  one line per sign-in code
     *   logs/mail.log       every email: recipient, subject, attachments and the plain-text body
     * Never registered outside APP_ENV=local, and logs/ is git-ignored.
     */
    private function logLocalMail(): void
    {
        if (! $this->app->environment('local')) {
            return;
        }
        Event::listen(MessageSent::class, function (MessageSent $event): void {
            $m = $event->message;
            $dir = env('LOCAL_LOG_DIR', base_path('../logs'));
            if (! is_dir($dir) && ! @mkdir($dir, 0775, true)) {
                return;
            }
            $at = now()->format('Y-m-d H:i:s');
            $to = implode(', ', array_map(fn ($a) => $a->getAddress(), $m->getTo()));
            $subject = (string) $m->getSubject();
            $files = array_map(fn ($a) => $a->getFilename() ?? 'attachment', $m->getAttachments());
            $html = (string) $m->getHtmlBody();
            $text = $m->getTextBody() ?? trim(html_entity_decode(strip_tags((string) preg_replace('/<(br|\/p|\/tr|\/h\d)[^>]*>/i', "\n", $html))));

            if (preg_match('/sign-in code:\s*(\d{6})/i', $subject, $code)) {
                $until = now()->addMinutes((int) config('placement.otp.ttl_minutes'))->format('H:i');
                file_put_contents("{$dir}/otp-codes.log", "{$at}  {$to}  code {$code[1]}  (valid until {$until})\n", FILE_APPEND | LOCK_EX);
            }

            $entry = str_repeat('=', 78)."\n"
                ."{$at}  EMAIL SENT\n"
                ."To:          {$to}\n"
                ."Subject:     {$subject}\n"
                .($files ? 'Attachments: '.implode(', ', $files)."\n" : '')
                .str_repeat('-', 78)."\n"
                .trim((string) preg_replace("/\n{3,}/", "\n\n", (string) $text))."\n\n";
            file_put_contents("{$dir}/mail.log", $entry, FILE_APPEND | LOCK_EX);
        });
    }
}
