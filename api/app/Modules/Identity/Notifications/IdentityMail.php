<?php

namespace App\Modules\Identity\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Identity emails: verification link, login code, staff invitation.
 * One small class keeps the wording in one place. Sent synchronously through App\Support\Outbox.
 */
class IdentityMail extends Notification
{
    private function __construct(private readonly string $kind, private readonly array $data) {}

    public static function verify(string $name, string $url): self
    {
        return new self('verify', compact('name', 'url'));
    }

    public static function loginCode(string $name, string $code, int $minutes): self
    {
        return new self('code', compact('name', 'code', 'minutes'));
    }

    public static function invitation(string $name, string $role, string $url, int $days): self
    {
        return new self('invite', compact('name', 'role', 'url', 'days'));
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $d = $this->data;

        return match ($this->kind) {
            'verify' => (new MailMessage)
                ->subject('Confirm your email · Career Services')
                ->greeting("Hello {$d['name']},")
                ->line('Confirm your university email to activate your internship placement account.')
                ->action('Confirm email', $d['url'])
                ->line('The link expires in 60 minutes. If you did not create an account, ignore this email.'),
            'code' => (new MailMessage)
                ->subject("Your sign-in code: {$d['code']}")
                ->greeting("Hello {$d['name']},")
                ->line("Your Career Services sign-in code is **{$d['code']}**.")
                ->line("It expires in {$d['minutes']} minutes and works once. If you did not try to sign in, change your password."),
            'invite' => (new MailMessage)
                ->subject('You have been invited to Career Services Placement')
                ->greeting("Hello {$d['name']},")
                ->line('You have been invited to join the internship placement system as **'.self::roleLabel($d['role']).'**.')
                ->action('Set your password', $d['url'])
                ->line("The invitation expires in {$d['days']} days."),
        };
    }

    public static function roleLabel(string $role): string
    {
        return ['staff' => 'Career Services staff', 'head' => 'Head of Career Services', 'president' => 'President'][$role] ?? $role;
    }
}
