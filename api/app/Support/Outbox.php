<?php

namespace App\Support;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Throwable;

/**
 * Sends an email synchronously and records it in email_log (used for the Gmail daily-limit guard, NFR-R4,
 * and for de-duplicating reminders later). Failures are logged and re-thrown only when $throw is true.
 */
class Outbox
{
    public static function send(string $email, Notification $notification, string $type, ?int $userId = null, bool $throw = false): bool
    {
        try {
            NotificationFacade::route('mail', $email)->notifyNow($notification);
            self::record($email, $type, 'sent', $userId);

            return true;
        } catch (Throwable $e) {
            self::record($email, $type, 'failed', $userId, $e->getMessage());
            report($e);
            if ($throw) {
                throw $e;
            }

            return false;
        }
    }

    public static function sentToday(): int
    {
        return DB::table('email_log')->where('status', 'sent')->where('sent_at', '>=', now()->startOfDay())->count();
    }

    public static function record(string $email, string $type, string $status, ?int $userId = null, ?string $error = null): void
    {
        DB::table('email_log')->insert([
            'to_email' => $email, 'user_id' => $userId, 'type' => $type, 'status' => $status,
            'error' => $error ? mb_substr($error, 0, 1000) : null, 'sent_at' => now(),
        ]);
    }
}
