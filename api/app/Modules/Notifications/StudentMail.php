<?php

namespace App\Modules\Notifications;

use App\Modules\Students\Models\StudentProfile;
use App\Support\Outbox;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** FR-N1: student event emails (interview outcome, organisation check result, letter sent). */
class StudentMail extends Notification
{
    private function __construct(private readonly string $subject, private readonly array $lines, private readonly ?string $action = null) {}

    public static function send(StudentProfile $student, string $type, string $subject, array $lines): void
    {
        if (! $student->user_id) {
            return; // registry-only students have no account to email
        }
        $url = config('placement.frontend_url').'/student';
        Outbox::send($student->university_email, new self($subject, $lines, $url), $type, $student->user_id);
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $m = (new MailMessage)->subject($this->subject.' · Career Services');
        foreach ($this->lines as $line) {
            $m->line($line);
        }
        if ($this->action) {
            $m->action('Open your placement page', $this->action);
        }

        return $m;
    }
}
