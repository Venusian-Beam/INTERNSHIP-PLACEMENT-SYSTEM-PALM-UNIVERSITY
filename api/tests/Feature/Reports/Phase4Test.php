<?php

use App\Modules\Applications\Models\Application;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Organisations\Models\Organisation;
use App\Modules\Placements\Models\Placement;
use App\Modules\Reports\Csv;
use App\Modules\Students\Models\StudentProfile;
use App\Support\Audit;

function reportFixture(): array
{
    $cycle = Cycle::create(['name' => 'Now', 'applications_open_at' => now()->subWeek(), 'applications_close_at' => now()->addWeek(),
        'letter_cutoff_at' => now()->addMonth(), 'default_period_start' => now()->addMonths(2)->toDateString(), 'default_period_end' => now()->addMonths(3)->toDateString()]);
    $org = Organisation::create(['name' => '=HYPERLINK("http://evil")', 'email' => 'o@o.example', 'status' => 'active', 'sector' => 'Banking']);
    $mk = function (string $prog, int $level, string $appStatus, ?string $placement) use ($cycle, $org) {
        $s = StudentProfile::create(['university_email' => uniqid().'@'.config('placement.student_email_domain'), 'full_name' => 'S '.uniqid(), 'programme' => $prog, 'level' => $level, 'on_registry' => true]);
        $a = Application::create(['student_profile_id' => $s->id, 'cycle_id' => $cycle->id, 'status' => $appStatus, 'submitted_at' => now(), 'matched_organisation_id' => $placement ? $org->id : null]);
        if ($placement) {
            Placement::create(['application_id' => $a->id, 'student_profile_id' => $s->id, 'organisation_id' => $org->id, 'cycle_id' => $cycle->id, 'status' => $placement]);
        }

        return $s;
    };
    $mk('Nursing', 400, 'passed', 'completed');
    $mk('Nursing', 300, 'passed', 'accepted');
    $mk('Nursing', 200, 'passed', 'declined');
    $mk('Education', 400, 'not_recommended', null);
    $mk('Education', 100, 'submitted', null);
    StudentProfile::create(['university_email' => 'never@'.config('placement.student_email_domain'), 'full_name' => 'Never Applied', 'programme' => 'Education', 'level' => 400, 'on_registry' => true]);

    return [$cycle, $org];
}

it('computes the pipeline from the records', function () {
    reportFixture();
    actingAsRole('staff');
    $this->getJson('/api/reports/pipeline')->assertOk()->assertJson(['pipeline' => [
        'Applied' => 5, 'Interviewed' => 4, 'Passed' => 3, 'Not recommended' => 1, 'Letter sent' => 3, 'Accepted' => 2, 'Declined' => 1, 'Completed' => 1,
    ]]);
});

it('graduation status distinguishes completed, not completed and never-registered students', function () {
    reportFixture();
    actingAsRole('staff');
    $rows = collect($this->getJson('/api/reports/graduation?programme=Education')->assertOk()->json('students'));
    expect($rows->firstWhere('full_name', 'Never Applied')['status'])->toBe('not_started');
    $nursing = collect($this->getJson('/api/reports/graduation?programme=Nursing')->json('students'));
    expect($nursing->where('status', 'completed')->count())->toBe(1)->and($nursing->where('status', 'not_completed')->count())->toBe(2);
});

it('dashboard returns queues, outcomes and programme stats for staff only', function () {
    reportFixture();
    actingAsRole('staff');
    $d = $this->getJson('/api/dashboard')->assertOk()->json();
    expect($d['outcomes'])->toBe(['accepted' => 2, 'awaiting' => 0, 'declined' => 1]);
    expect($d['queues']['to_interview'])->toBe(1);
    $nursing = collect($d['by_programme'])->firstWhere('programme', 'Nursing');
    expect($nursing['applied'])->toBe(3)->and($nursing['accepted'])->toBe(2);
    actingAsRole('student');
    $this->getJson('/api/dashboard')->assertForbidden();
    $this->getJson('/api/reports/graduation')->assertForbidden();
    actingAsRole('president');
    $this->getJson('/api/reports/pipeline')->assertForbidden();
});

it('CSV exports neutralise spreadsheet formulas (FR-R5)', function () {
    reportFixture();
    actingAsRole('staff');
    $res = $this->get('/api/reports/organisations?format=csv')->assertOk();
    expect($res->headers->get('Content-Type'))->toContain('text/csv');
    $body = $res->streamedContent();
    expect($body)->toContain("'=HYPERLINK")->not->toContain(',=HYPERLINK')->not->toContain("\n=HYPERLINK");
    expect(Csv::safe('@SUM(A1)'))->toBe("'@SUM(A1)")->and(Csv::safe('Normal'))->toBe('Normal')->and(Csv::safe('-5'))->toBe("'-5");
});

it('audit trail is visible to the Head only', function () {
    Audit::log('test.action');
    actingAsRole('staff');
    $this->getJson('/api/audit')->assertForbidden();
    actingAsRole('head');
    $this->getJson('/api/audit')->assertOk()->assertJsonPath('entries.0.action', 'test.action');
});

it('gives the dashboard weekly sparklines and one stage per student', function () {
    $this->seed();
    actingAsRole('staff');
    $res = $this->getJson('/api/dashboard')->assertOk();
    $spark = $res->json('spark');
    expect($spark['weeks'])->not->toBeEmpty()->and(count($spark['weeks']))->toBeLessThanOrEqual(12);
    foreach (['applications', 'interviewed', 'letters_sent', 'accepted'] as $k) {
        expect($spark[$k])->toHaveCount(count($spark['weeks']));
    }
    // Every known student appears in exactly one stage.
    expect(array_sum($res->json('stages')))->toBe(StudentProfile::count());
});
