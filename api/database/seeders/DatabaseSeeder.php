<?php

namespace Database\Seeders;

use App\Models\User;
use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\FileService;
use App\Modules\Letters\LetterRenderer;
use App\Modules\Letters\Models\Letter;
use App\Modules\Letters\Models\LetterTemplate;
use App\Modules\Letters\TemplateSanitizer;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use App\Modules\Students\Models\StudentProfile;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;

/**
 * Development/demo data only. Fictional people and organisations (AD9: no real data outside production).
 * Every seeded account uses the password in DEMO_PASSWORD.
 */
class DatabaseSeeder extends Seeder
{
    public const DEMO_PASSWORD = 'Placement2026!';

    /** What an uploaded-and-edited Word letter looks like after conversion: logo letterhead, fields, signature block. */
    private function uploadedTemplateHtml(): string
    {
        // A demo crest (green shield) drawn with GD, embedded like a logo from a Word header.
        $img = imagecreatetruecolor(72, 80);
        imagesavealpha($img, true);
        imagefill($img, 0, 0, imagecolorallocatealpha($img, 255, 255, 255, 127));
        $green = imagecolorallocate($img, 21, 128, 61);
        $gold = imagecolorallocate($img, 245, 158, 11);
        imagefilledpolygon($img, [36, 2, 70, 14, 66, 50, 36, 78, 6, 50, 2, 14], $green);
        imagefilledrectangle($img, 20, 30, 52, 50, $gold);
        imageline($img, 36, 30, 36, 50, $green);
        ob_start();
        imagepng($img);
        $logo = base64_encode((string) ob_get_clean());

        return '<p style="text-align: center"><img src="data:image/png;base64,'.$logo.'" alt="University crest"></p>'
            .'<h2 style="text-align: center">UNIVERSITY CAREER SERVICES</h2>'
            .'<p style="text-align: center">Office of Career Services · P.O. Box LG 25, Accra · careers@university.example</p><hr>'
            .'<p style="text-align: right">Our ref: <span data-field="reference">x</span><br><span data-field="date">x</span></p>'
            .'<p><span data-field="addressee">x</span><br><span data-field="organisation.name">x</span><br><span data-field="organisation.address">x</span></p>'
            .'<p>Dear Sir/Madam,</p><p><strong><u>INTRODUCTION OF STUDENT(S) FOR INTERNSHIP</u></strong></p>'
            .'<p>We write to introduce <span data-field="students.names">x</span>, student(s) of the University who wish to undertake an internship '
            .'with <span data-field="organisation.name">x</span> from <span data-field="period.start">x</span> to <span data-field="period.end">x</span>.</p>'
            .'<p><span data-field="students.table">x</span></p>'
            .'<p>Their CVs are attached. Career Services would be grateful for any assistance you can offer them.</p>'
            .'<p>Yours faithfully,</p><p><span data-signature="">x</span></p><p><strong>President</strong></p>';
    }

    /** Template v1 approved, v2 waiting for the President, a demo signature, and matched students ready for letters. */
    private function seedLetters(): void
    {
        $head = User::where('role', 'head')->first();
        $president = User::where('role', 'president')->first();
        LetterTemplate::create(['version' => 1, 'body' => LetterRenderer::DEFAULT_BODY, 'status' => 'approved', 'created_by' => $head->id,
            'submitted_by' => $head->id, 'submitted_at' => now()->subMonths(2), 'decided_by' => $president->id, 'decided_at' => now()->subMonths(2)]);
        // v2 was uploaded from a Word file and edited in the browser (format html): its own letterhead, fields, signature.
        LetterTemplate::create(['version' => 2, 'format' => 'html', 'body' => TemplateSanitizer::clean($this->uploadedTemplateHtml()),
            'status' => 'with_president', 'created_by' => $head->id, 'submitted_by' => $head->id, 'submitted_at' => now()->subDay()]);

        // A demo signature (a drawn scribble), stored privately like the real one will be (OQ3).
        $img = imagecreatetruecolor(360, 90);
        imagesavealpha($img, true);
        imagefill($img, 0, 0, imagecolorallocatealpha($img, 255, 255, 255, 127));
        $ink = imagecolorallocate($img, 29, 60, 143);
        imagesetthickness($img, 3);
        $prev = [20, 60];
        for ($x = 20; $x <= 330; $x += 6) {
            $pt = [$x, (int) (50 + 22 * sin($x / 14) * cos($x / 37))];
            imageline($img, $prev[0], $prev[1], $pt[0], $pt[1], $ink);
            $prev = $pt;
        }
        ob_start();
        imagepng($img);
        $png = ob_get_clean();
        $sig = app(FileService::class)->put('signature', 'image/png', 'signature.png', $png, $head);
        DB::table('settings')->insert(['key' => 'signature_file_id', 'value' => json_encode($sig->id), 'created_at' => now(), 'updated_at' => now()]);

        // Matched students in the current cycle (so the letter workspace has work), plus submitted applications.
        $cycle = Cycle::where('name', 'Long break 2027')->first();
        $orgs = Organisation::pluck('id', 'name');
        $cv = fn (StudentProfile $p) => $p->update(['cv_file_id' => app(FileService::class)->put('cv', 'application/pdf', "CV {$p->full_name}.pdf",
            "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF", $p->user)->id]);
        foreach ([['ama.mensah', 'Volta Telecom Ltd', 'passed'], ['kofi.boateng', 'Volta Telecom Ltd', 'passed'], ['akosua.darko', 'Korle Health Services', 'passed'],
            ['yaw.asante', 'Coastal Bank Ghana', 'submitted'], ['esi.owusu', 'Ashanti Agro Ltd', 'submitted']] as [$local, $orgName, $status]) {
            $p = StudentProfile::where('university_email', $local.'@'.config('placement.student_email_domain'))->first();
            $cv($p);
            $app = Application::create(['student_profile_id' => $p->id, 'cycle_id' => $cycle->id, 'status' => $status,
                'motivation' => "I want practical experience in my field at {$orgName}.", 'submitted_at' => now()->subWeeks(2),
                'interview_date' => $status === 'passed' ? now()->subWeek() : null, 'matched_organisation_id' => $status === 'passed' ? $orgs[$orgName] : null,
                'outcome_recorded_by' => $status === 'passed' ? $head->id : null, 'outcome_recorded_at' => $status === 'passed' ? now()->subWeek() : null]);
            $app->choices()->create(['rank' => 1, 'organisation_id' => $orgs[$orgName]]);
            if ($status === 'passed') {
                Placement::create(['application_id' => $app->id, 'student_profile_id' => $p->id, 'organisation_id' => $orgs[$orgName], 'cycle_id' => $cycle->id, 'status' => 'letter_pending']);
            }
        }
        // Esi also proposed an organisation that is waiting for a check.
        $esi = StudentProfile::where('university_email', 'esi.owusu@'.config('placement.student_email_domain'))->first();
        $kasoa = Organisation::create(['name' => 'Kasoa Fresh Foods', 'email' => 'info@kasoafresh.example', 'address' => 'Kasoa Market Road', 'status' => 'pending_check', 'proposed_by_student_id' => $esi->id]);
        $esi->applications()->first()->choices()->create(['rank' => 2, 'organisation_id' => $kasoa->id]);
    }

    public function run(): void
    {
        if (App::environment('production')) {
            $this->command?->error('Refusing to seed demo data in production.');

            return;
        }

        $domain = config('placement.student_email_domain');
        $make = fn (string $name, string $email, string $role) => User::create([
            'name' => $name, 'email' => $email, 'password' => self::DEMO_PASSWORD, 'role' => $role,
            'email_verified_at' => now(), 'privacy_accepted_at' => now(),
        ]);

        $make('Akua Boateng', 'head@careers.example', 'head');
        $make('Kwabena Owusu', 'staff@careers.example', 'staff');
        $make('Office of the President', 'president@careers.example', 'president');

        // Cycles: the current one is open for applications now; last year's is history for reports.
        Cycle::create(['name' => 'Long break 2026', 'applications_open_at' => '2026-03-01', 'applications_close_at' => '2026-04-30 23:59:59',
            'letter_cutoff_at' => '2026-07-15 23:59:59', 'default_period_start' => '2026-06-01', 'default_period_end' => '2026-08-31']);
        Cycle::create(['name' => 'Long break 2027', 'applications_open_at' => '2026-10-01', 'applications_close_at' => '2027-01-31 23:59:59',
            'letter_cutoff_at' => '2027-04-30 23:59:59', 'default_period_start' => '2027-06-01', 'default_period_end' => '2027-08-31']);

        foreach ([
            ['Volta Telecom Ltd', 'The HR Manager', '12 Independence Ave, Accra', 'hr@voltatelecom.example', 'Telecoms'],
            ['Coastal Bank Ghana', 'Head of Talent', '4 Ring Road Central, Accra', 'talent@coastalbank.example', 'Banking'],
            ['Korle Health Services', 'Human Resources Officer', 'Korle Bu, Accra', 'hr@korlehealth.example', 'Health'],
            ['Tema Port Logistics', 'HR Department', 'Harbour Road, Tema', 'careers@temaport.example', 'Logistics'],
            ['Ashanti Agro Ltd', 'The Manager', 'Adum, Kumasi', 'info@ashantiagro.example', 'Agriculture'],
            ['Accra Digital Hub', 'Programme Lead', 'Osu, Accra', 'hello@accradigital.example', 'Technology'],
        ] as [$name, $contact, $addr, $email, $sector]) {
            Organisation::create(['name' => $name, 'contact_person' => $contact, 'address' => $addr, 'email' => $email,
                'sector' => $sector, 'status' => 'active', 'phone' => '030 000 0000']);
        }

        // Students who registered (can sign in) + registry-only students (imported, never signed up).
        $students = [
            ['Ama Mensah', 'ama.mensah', 'Computer Science', 300, true],
            ['Kofi Boateng', 'kofi.boateng', 'Computer Science', 200, true],
            ['Akosua Darko', 'akosua.darko', 'Nursing', 300, true],
            ['Yaw Asante', 'yaw.asante', 'Economics', 200, true],
            ['Esi Owusu', 'esi.owusu', 'Agriculture', 400, true],
            // Fresh account for walking through the whole journey: registered, no application, no CV yet.
            ['Abena Adjei', 'abena.adjei', 'Business Admin', 300, true],
        ];
        $programmes = ['Computer Science', 'Nursing', 'Accounting', 'Engineering', 'Business Admin', 'Agriculture', 'Economics', 'Education'];
        foreach ($students as [$name, $local, $prog, $level]) {
            $user = $make($name, "{$local}@{$domain}", 'student');
            StudentProfile::create(['user_id' => $user->id, 'university_email' => $user->email, 'full_name' => $name,
                'student_number' => (string) random_int(10000000, 19999999), 'programme' => $prog, 'level' => $level,
                'phone' => '024 000 0000', 'on_registry' => true, 'expected_grad_year' => StudentProfile::deriveGradYear($level)]);
        }
        $this->seedLetters();

        foreach (range(1, 120) as $i) {
            $level = [100, 200, 300, 300, 400][$i % 5];
            StudentProfile::create(['university_email' => "registry.student{$i}@{$domain}", 'full_name' => fake()->name(),
                'student_number' => (string) (20000000 + $i), 'programme' => $programmes[$i % count($programmes)], 'level' => $level,
                'on_registry' => true, 'expected_grad_year' => StudentProfile::deriveGradYear($level)]);
        }

        $this->seedHistory();
    }

    /**
     * Demo history so the dashboard and reports have something to show: last year's cycle with real outcomes
     * (sent letters, accepted/declined/completed placements) and this cycle's applications spread over the window.
     * Uses registry students (fictional), with uneven participation per programme so the charts tell a story.
     */
    private function seedHistory(): void
    {
        $head = User::where('role', 'head')->first();
        $template = LetterTemplate::where('version', 1)->first();
        $orgs = Organisation::where('status', 'active')->get();
        $past = Cycle::where('name', 'Long break 2026')->first();
        $current = Cycle::where('name', 'Long break 2027')->first();
        $weight = ['Computer Science' => 0.55, 'Nursing' => 0.5, 'Accounting' => 0.45, 'Engineering' => 0.35, 'Business Admin' => 0.3,
            'Agriculture' => 0.45, 'Economics' => 0.25, 'Education' => 0.12];
        $registry = StudentProfile::whereNull('user_id')->orderBy('id')->get();
        mt_srand(2026);

        // Last year: applications → outcomes → letters (sent manually) → placement results.
        $placements = [];
        foreach ($registry as $s) {
            if (mt_rand() / mt_getrandmax() > $weight[$s->programme] * 0.9) {
                continue;
            }
            $pass = mt_rand(1, 10) > 2;
            $org = $orgs[mt_rand(0, $orgs->count() - 1)];
            $app = Application::create(['student_profile_id' => $s->id, 'cycle_id' => $past->id, 'status' => $pass ? 'passed' : 'not_recommended',
                'motivation' => 'Practical experience.', 'submitted_at' => $past->applications_open_at->copy()->addDays(mt_rand(0, 55)),
                'interview_date' => '2026-05-10', 'matched_organisation_id' => $pass ? $org->id : null, 'outcome_recorded_by' => $head->id, 'outcome_recorded_at' => '2026-05-10']);
            if ($pass) {
                $placements[$org->id][] = $app;
            }
        }
        foreach ($placements as $orgId => $apps) {
            $seq = DB::selectOne("select nextval('letter_ref_seq') as n")->n;
            $org = $orgs->firstWhere('id', $orgId);
            $letter = Letter::create(['reference_no' => sprintf('CS/INT/2026/%04d', $seq), 'cycle_id' => $past->id, 'organisation_id' => $orgId, 'template_id' => $template->id,
                'issue_date' => '2026-05-20', 'period_start' => '2026-06-01', 'period_end' => '2026-08-31', 'status' => 'sent', 'send_mode' => 'manual',
                'recipient_email' => $org->email, 'addressee_snapshot' => $org->only(['name', 'address', 'email', 'contact_person', 'contact_title']),
                'sent_by' => $head->id, 'sent_at' => '2026-05-20 10:00:00']);
            foreach ($apps as $app) {
                $r = mt_rand(1, 10);
                $status = $r <= 5 ? 'completed' : ($r <= 7 ? 'accepted' : ($r <= 9 ? 'declined' : 'letter_sent'));
                Placement::create(['application_id' => $app->id, 'student_profile_id' => $app->student_profile_id, 'organisation_id' => $orgId,
                    'cycle_id' => $past->id, 'letter_id' => $letter->id, 'status' => $status,
                    'completed_by' => $status === 'completed' ? $head->id : null, 'completed_at' => $status === 'completed' ? '2026-09-15' : null]);
            }
        }

        // This cycle: submitted applications spread over the weeks since it opened (more toward the deadline).
        foreach ($registry->shuffle() as $s) {
            if (Application::where('student_profile_id', $s->id)->where('cycle_id', $current->id)->exists()
                || mt_rand() / mt_getrandmax() > $weight[$s->programme]) {
                continue;
            }
            $days = (int) min(now()->diffInDays($current->applications_open_at, true), 36);
            $app = Application::create(['student_profile_id' => $s->id, 'cycle_id' => $current->id, 'status' => 'submitted', 'motivation' => 'Practical experience.',
                'submitted_at' => $current->applications_open_at->copy()->addDays((int) round($days * sqrt(mt_rand() / mt_getrandmax())))]);
            $app->choices()->create(['rank' => 1, 'organisation_id' => $orgs[mt_rand(0, $orgs->count() - 1)]->id]);
        }
    }
}
