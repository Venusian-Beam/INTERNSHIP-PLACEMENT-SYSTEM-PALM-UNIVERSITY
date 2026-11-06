<?php

namespace App\Modules\Letters;

use App\Modules\Files\FileService;
use App\Modules\Files\Models\StoredFile;
use App\Modules\Letters\Models\Letter;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Renders a letter from the approved template (R1–R3, D14). Every value is filled from records and HTML-escaped;
 * there is deliberately no student-ID placeholder. The President's signature is embedded server-side only (NFR-S7).
 */
class LetterRenderer
{
    public const PLACEHOLDERS = [
        'reference' => 'Letter reference number',
        'date' => 'Issue date',
        'addressee' => 'Contact person and title',
        'organisation.name' => 'Organisation name',
        'organisation.address' => 'Organisation address',
        'period.start' => 'Internship start date',
        'period.end' => 'Internship end date',
        'student_count' => 'Number of students',
        'students.table' => 'Table of students: name, programme, level',
        'students.names' => 'Student names in a sentence (e.g. "Ama Mensah and Kofi Boateng")',
    ];

    public const DEFAULT_BODY = "{{addressee}}\n{{organisation.name}}\n{{organisation.address}}\n\nDear Sir/Madam,\n\n"
        ."INTRODUCTION OF STUDENT(S) FOR INTERNSHIP\n\n"
        .'We write to introduce the following student(s) of the University, who wish to undertake an internship with your '
        ."organisation from {{period.start}} to {{period.end}}.\n\n{{students.table}}\n\n"
        .'Their CVs are attached. We would be grateful for any assistance you can offer them.';

    public function __construct(private readonly FileService $files) {}

    /** Reject unknown placeholders so a typo can't print raw braces on an official letter. */
    public static function validateBody(string $body): void
    {
        preg_match_all('/{{\s*([^}]+?)\s*}}/', $body, $m);
        $unknown = array_diff(array_unique($m[1]), array_keys(self::PLACEHOLDERS));
        if ($unknown) {
            throw ValidationException::withMessages(['body' => 'Unknown placeholder(s): '.implode(', ', $unknown).'.']);
        }
        if (! str_contains($body, '{{students.table}}')) {
            throw ValidationException::withMessages(['body' => 'The template must include {{students.table}}.']);
        }
    }

    public function forLetter(Letter $letter): string
    {
        $letter->loadMissing(['organisation', 'template', 'placements.student']);
        $org = $letter->addressee_snapshot ?: $this->addressee($letter);
        $students = $letter->placements->map(fn ($p) => [$p->student->full_name, $p->student->programme, $p->student->level])->sortBy(0)->values()->all();

        return $this->html($letter->template->body, [
            'reference' => $letter->reference_no, 'date' => $letter->issue_date->format('j F Y'),
            'addressee' => trim(($org['contact_person'] ?? '').(! empty($org['contact_title']) ? ', '.$org['contact_title'] : '')) ?: 'The Manager',
            'organisation.name' => $org['name'], 'organisation.address' => $org['address'] ?? '',
            'period.start' => $letter->period_start->format('j F Y'), 'period.end' => $letter->period_end->format('j F Y'),
            'student_count' => (string) count($students),
        ], $students, $letter->template->format ?? 'text');
    }

    public function sample(string $body, string $format = 'text'): string
    {
        return $this->html($body, [
            'reference' => config('placement.letters.ref_prefix').'/'.now()->year.'/0000', 'date' => now()->format('j F Y'),
            'addressee' => 'The HR Manager', 'organisation.name' => 'Sample Organisation Ltd', 'organisation.address' => '1 Sample Street, Accra',
            'period.start' => '1 June '.now()->addYear()->year, 'period.end' => '31 August '.now()->addYear()->year, 'student_count' => '2',
        ], [['Student One', 'Computer Science', 300], ['Student Two', 'Accounting', 200]], $format);
    }

    public function pdf(string $html): string
    {
        return Pdf::loadHTML($html)->setPaper('a4')->setOption(['isRemoteEnabled' => false, 'isPhpEnabled' => false])->output();
    }

    public function addressee(Letter $letter): array
    {
        return $letter->organisation->only(['name', 'address', 'email', 'contact_person', 'contact_title']);
    }

    private function html(string $body, array $values, array $students, string $format = 'text'): string
    {
        $table = '<table class="students"><thead><tr><th>Name</th><th>Programme</th><th>Level</th></tr></thead><tbody>'
            .implode('', array_map(fn ($s) => '<tr><td>'.e($s[0]).'</td><td>'.e($s[1] ?? '').'</td><td>'.e((string) ($s[2] ?? '')).'</td></tr>', $students))
            .'</tbody></table>';
        $names = array_map(fn ($s) => (string) $s[0], $students);
        $values['students.names'] = count($names) > 1 ? implode(', ', array_slice($names, 0, -1)).' and '.end($names) : ($names[0] ?? '');

        if ($format === 'html') {
            return $this->uploadedHtml($body, $values, $students, $table);
        }

        $out = nl2br(e($body), false);
        foreach ($values as $k => $v) {
            $out = preg_replace('/{{\s*'.preg_quote($k, '/').'\s*}}/', nl2br(e($v), false), $out);
        }
        $out = preg_replace('/(<br>\s*)?{{\s*students\.table\s*}}(\s*<br>)?/', $table, $out);

        $sig = $this->signatureDataUri();
        $uni = e(config('placement.university_name'));
        $signature = $sig ? '<img src="'.$sig.'" alt="Signature" style="height:60px">' : '<p style="color:#888">[Signature on file]</p>';

        return '<!doctype html><html><head><meta charset="utf-8"><style>'
            .'body{font-family:DejaVu Serif,Georgia,serif;font-size:12.5px;color:#141414;line-height:1.5;margin:24px 36px}'
            .'.lh{border-bottom:2px solid #0F7A3D;padding-bottom:8px;margin-bottom:16px}.uni{color:#0F7A3D;font-size:17px;font-weight:bold}'
            .'.meta{font-size:11px;color:#555}.students{border-collapse:collapse;margin:8px 0 12px;width:100%}'
            .'.students th,.students td{border:1px solid #ccc;padding:4px 8px;text-align:left}.students th{background:#f2f2f2}'
            .'</style></head><body>'
            .'<div class="lh"><div class="uni">'.$uni.'</div><div class="meta">Office of Career Services</div>'
            .'<div class="meta">Ref: '.e($values['reference']).' · '.e($values['date']).'</div></div>'
            .'<div>'.$out.'</div>'
            .'<div style="margin-top:22px"><p>Yours faithfully,</p>'.$signature.'<p>President</p></div>'
            .'</body></html>';
    }

    /**
     * Uploaded template (format = html, already sanitised by TemplateSanitizer when saved): the letterhead and
     * closing come from the file. Field markers become HTML-escaped values; the signature goes where it was placed.
     */
    private function uploadedHtml(string $body, array $values, array $students, string $table): string
    {
        // A students table on its own line replaces the whole paragraph (a table can't sit inside a <p>).
        $out = (string) preg_replace('#<p[^>]*>\s*<span data-field="students\.table">[^<]*</span>\s*</p>#', $table, $body);
        $out = (string) preg_replace_callback('#<span data-field="([a-z._]+)">[^<]*</span>#', function ($m) use ($values, $table) {
            return $m[1] === 'students.table' ? $table : e($values[$m[1]] ?? '');
        }, $out);

        $sig = $this->signatureDataUri();
        $signature = $sig ? '<img src="'.$sig.'" alt="Signature" style="height:60px">' : '<span style="color:#888">[Signature on file]</span>';
        $out = (string) preg_replace('#<span data-signature="">[^<]*</span>#', $signature, $out);

        return '<!doctype html><html><head><meta charset="utf-8"><style>'
            .'@page{margin:16mm 18mm}body{font-family:DejaVu Serif,Georgia,serif;font-size:12px;color:#141414;line-height:1.45;margin:0}'
            .'p{margin:0 0 8px}h1,h2,h3,h4{margin:0 0 8px}img{max-width:100%}table{border-collapse:collapse}td,th{vertical-align:top;padding:2px 6px}'
            .'.students{margin:6px 0 12px;width:100%}.students th,.students td{border:1px solid #ccc;padding:4px 8px;text-align:left}.students th{background:#f2f2f2}'
            .'</style></head><body>'.$out.'</body></html>';
    }

    /** What an uploaded template still needs before it can go to the President (FR-T1). Empty = ready. */
    public static function missingForSubmit(string $body, string $format): array
    {
        if ($format !== 'html') {
            return str_contains($body, '{{students.table}}') ? [] : ['the students table'];
        }
        $has = fn (string $key) => str_contains($body, 'data-field="'.$key.'"');
        $missing = [];
        if (! $has('reference')) {
            $missing[] = 'the reference number';
        }
        if (! $has('organisation.name')) {
            $missing[] = 'the organisation name';
        }
        if (! $has('students.table') && ! $has('students.names')) {
            $missing[] = 'the students (table or names)';
        }
        if (! str_contains($body, 'data-signature=')) {
            $missing[] = 'the signature';
        }

        return $missing;
    }

    private function signatureDataUri(): ?string
    {
        $id = DB::table('settings')->where('key', 'signature_file_id')->value('value');
        $file = $id ? StoredFile::find(json_decode($id)) : null;
        if (! $file) {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode($this->files->contents($file));
    }
}
