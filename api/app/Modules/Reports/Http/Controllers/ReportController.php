<?php

namespace App\Modules\Reports\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Reports\Csv;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** FR-R1–R5 (D29, D36). Every report renders as JSON or, with ?format=csv, as a safe CSV download. */
class ReportController extends Controller
{
    public function pipeline(Request $request)
    {
        $cycle = $this->cycle($request);
        $rows = self::pipelineCounts($cycle->id);
        if ($request->query('format') === 'csv') {
            return Csv::download("pipeline-{$cycle->name}", ['Stage', 'Count'], array_map(fn ($k, $v) => [$k, $v], array_keys($rows), $rows));
        }

        return response()->json(['cycle' => $cycle->name, 'pipeline' => $rows]);
    }

    /** FR-R2: every known student (registered or imported) — Completed, Not completed, or Not started (D30). */
    public function graduation(Request $request)
    {
        // QA-4-01: validate filters (a non-numeric level used to reach SQL and cause a 500).
        $request->validate([
            'programme' => ['nullable', 'string', 'max:120'], 'level' => ['nullable', 'integer', 'between:100,600'],
            'status' => ['nullable', 'in:completed,not_completed,not_started'], 'format' => ['nullable', 'in:csv'],
        ]);
        $q = DB::table('student_profiles as s')
            ->leftJoin(DB::raw("(select student_profile_id, max(case when status='completed' then 1 else 0 end) as done from placements group by student_profile_id) p"), 'p.student_profile_id', '=', 's.id')
            ->leftJoin(DB::raw('(select student_profile_id, count(*) as apps from applications where status <> \'draft\' group by student_profile_id) a'), 'a.student_profile_id', '=', 's.id')
            ->selectRaw("s.id, s.full_name, s.programme, s.level, s.expected_grad_year, s.on_registry, (s.user_id is not null) as registered,
                case when coalesce(p.done,0)=1 then 'completed' when s.user_id is null and coalesce(a.apps,0)=0 then 'not_started' else 'not_completed' end as status")
            ->orderBy('s.programme')->orderBy('s.full_name');
        foreach (['programme', 'level'] as $f) {
            if ($request->filled($f)) {
                $q->where("s.{$f}", $request->input($f));
            }
        }
        if ($request->filled('status')) {
            $q->whereRaw("(case when coalesce(p.done,0)=1 then 'completed' when s.user_id is null and coalesce(a.apps,0)=0 then 'not_started' else 'not_completed' end) = ?", [$request->input('status')]);
        }
        $rows = $q->limit(5000)->get();
        if ($request->query('format') === 'csv') {
            return Csv::download('graduation-status', ['Name', 'Programme', 'Level', 'Expected graduation', 'Registered', 'Status'],
                $rows->map(fn ($r) => [$r->full_name, $r->programme, $r->level, $r->expected_grad_year, $r->registered ? 'yes' : 'no', str_replace('_', ' ', $r->status)]));
        }

        return response()->json(['students' => $rows, 'summary' => $rows->countBy('status'), 'programmes' => DB::table('student_profiles')->whereNotNull('programme')->distinct()->orderBy('programme')->pluck('programme')]);
    }

    /** FR-R3: placements by organisation with acceptance rate. */
    public function organisations(Request $request)
    {
        $cycle = $this->cycle($request);
        $rows = DB::table('placements as p')->join('organisations as o', 'o.id', '=', 'p.organisation_id')->where('p.cycle_id', $cycle->id)
            ->groupBy('o.id', 'o.name', 'o.sector')
            ->selectRaw("o.name, o.sector, count(*) filter (where p.status <> 'letter_pending') as letters,
                count(*) filter (where p.status in ('accepted','completed')) as accepted,
                count(*) filter (where p.status = 'declined') as declined")
            ->orderByDesc('accepted')->get()
            ->map(function ($r) {
                $decided = $r->accepted + $r->declined;
                $r->acceptance_rate = $decided ? round($r->accepted / $decided * 100, 1) : null;

                return $r;
            });
        if ($request->query('format') === 'csv') {
            return Csv::download("organisations-{$cycle->name}", ['Organisation', 'Sector', 'Letters', 'Accepted', 'Declined', 'Acceptance rate %'],
                $rows->map(fn ($r) => [$r->name, $r->sector, $r->letters, $r->accepted, $r->declined, $r->acceptance_rate]));
        }

        return response()->json(['cycle' => $cycle->name, 'organisations' => $rows]);
    }

    /** FR-R4: breakdown by programme (participation and placement) and by organisation sector. */
    public function programmes(Request $request)
    {
        $cycle = $this->cycle($request);
        $programmes = self::programmeStats($cycle->id);
        $sectors = DB::table('placements as p')->join('organisations as o', 'o.id', '=', 'p.organisation_id')->where('p.cycle_id', $cycle->id)
            ->whereIn('p.status', ['accepted', 'completed'])->groupBy('o.sector')->selectRaw("coalesce(o.sector,'Unspecified') as sector, count(*) as accepted")
            ->orderByDesc('accepted')->get();
        if ($request->query('format') === 'csv') {
            return Csv::download("programmes-{$cycle->name}", ['Programme', 'Registered students', 'Applied', 'Participation %', 'Accepted', 'Placement rate %'],
                array_map(fn ($r) => [$r['programme'], $r['students'], $r['applied'], $r['participation'], $r['accepted'], $r['placement_rate']], $programmes));
        }

        return response()->json(['cycle' => $cycle->name, 'programmes' => $programmes, 'sectors' => $sectors]);
    }

    public static function pipelineCounts(int $cycleId): array
    {
        $a = DB::table('applications')->where('cycle_id', $cycleId)->selectRaw("
            count(*) filter (where status <> 'draft') as applied,
            count(*) filter (where status in ('passed','not_recommended')) as interviewed,
            count(*) filter (where status = 'passed') as passed,
            count(*) filter (where status = 'not_recommended') as not_recommended")->first();
        $p = DB::table('placements')->where('cycle_id', $cycleId)->selectRaw("
            count(*) filter (where status <> 'letter_pending') as letter_sent,
            count(*) filter (where status in ('accepted','completed')) as accepted,
            count(*) filter (where status = 'declined') as declined,
            count(*) filter (where status = 'completed') as completed")->first();

        return ['Applied' => (int) $a->applied, 'Interviewed' => (int) $a->interviewed, 'Passed' => (int) $a->passed, 'Not recommended' => (int) $a->not_recommended,
            'Letter sent' => (int) $p->letter_sent, 'Accepted' => (int) $p->accepted, 'Declined' => (int) $p->declined, 'Completed' => (int) $p->completed];
    }

    /** Per programme: registered students (all known), applications this cycle, accepted this cycle. */
    public static function programmeStats(int $cycleId): array
    {
        $students = DB::table('student_profiles')->whereNotNull('programme')->groupBy('programme')->selectRaw('programme, count(*) as n')->pluck('n', 'programme');
        $applied = DB::table('applications as a')->join('student_profiles as s', 's.id', '=', 'a.student_profile_id')
            ->where('a.cycle_id', $cycleId)->where('a.status', '<>', 'draft')->groupBy('s.programme')->selectRaw('s.programme, count(*) as n')->pluck('n', 'programme');
        $accepted = DB::table('placements as p')->join('student_profiles as s', 's.id', '=', 'p.student_profile_id')
            ->where('p.cycle_id', $cycleId)->whereIn('p.status', ['accepted', 'completed'])->groupBy('s.programme')->selectRaw('s.programme, count(*) as n')->pluck('n', 'programme');

        return collect($students)->keys()->map(fn ($prog) => [
            'programme' => $prog, 'students' => (int) $students[$prog], 'applied' => (int) ($applied[$prog] ?? 0), 'accepted' => (int) ($accepted[$prog] ?? 0),
            'participation' => $students[$prog] ? round(($applied[$prog] ?? 0) / $students[$prog] * 100, 1) : 0,
            'placement_rate' => ($applied[$prog] ?? 0) ? round(($accepted[$prog] ?? 0) / $applied[$prog] * 100, 1) : null,
        ])->sortByDesc('applied')->values()->all();
    }

    private function cycle(Request $request): Cycle
    {
        $request->validate(['cycle_id' => ['nullable', 'integer']]);

        return $request->filled('cycle_id') ? Cycle::findOrFail($request->integer('cycle_id')) : (Cycle::current() ?? abort(404, 'No cycle.'));
    }
}
