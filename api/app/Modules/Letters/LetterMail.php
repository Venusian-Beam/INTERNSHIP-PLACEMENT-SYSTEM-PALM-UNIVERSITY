<?php

namespace App\Modules\Letters;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** The introductory letter email to the organisation: PDF + the listed students' CVs (D19). */
class LetterMail extends Mailable
{
    /** @param list<array{name: string, bytes: string, mime: string}> $files */
    public function __construct(private readonly string $reference, private readonly string $orgName, private readonly array $files) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Introduction of student(s) for internship · {$this->reference}");
    }

    public function content(): Content
    {
        return new Content(htmlString: '<p>Dear Sir/Madam,</p><p>Please find attached an introductory letter from the University\'s Career Services for '
            .e($this->orgName).' (reference '.e($this->reference).'), together with the students\' CVs.</p>'
            .'<p>Kind regards,<br>Office of Career Services</p>');
    }

    public function attachments(): array
    {
        return array_map(fn ($f) => Attachment::fromData(fn () => $f['bytes'], $f['name'])->withMime($f['mime']), $this->files);
    }
}
