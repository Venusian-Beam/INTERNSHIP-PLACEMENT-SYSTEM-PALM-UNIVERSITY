<?php

namespace App\Modules\Dashboard\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Reports\Http\Controllers\ReportController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/** T1 staff dashboard (D27 work queues + UI-D12/FR-R6 insights). All figures come from the database, never invented. */
class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $cycle = Cycle::current();
        if (! $cycle) {
            return response()->json(['cycle' => null]);
        }
        $prev = Cycle::where('applications_open_at', '<', $cycle->applications_open_at)->orderByDesc('applications_open_at')->first();
        $now = ReportController::pipelineCounts($cycle->id);
        $before = $prev ? ReportController::pipelineCounts($prev->id) : null;

        $lettersSent = DB::table('letters')->where('cycle_id', $cycle->id)->where('status', 'sent');
        $finalYears = DB::table('student_profiles')->where('level', '>=', 400);
        $finalNotDone = (clone $finalYears)->whereNotExists(fn ($q) => $q->from('placements')->whereColumn('placements.student_profile_id', 'student_profiles.id')->where('status', 'completed'))->count();

        $p = fn (array $statuses) => DB::table('placements')->where('cycle_id', $cycle->id)->whereIn('status', $statuses);

        return response()->json([
            'cycle' => ['id' => $cycle->id, 'name' => $cycle->name, 'opens' => $cycle->applications_open_at->toDateString(), 'closes' => $cycle->applications_close_at->toDateString()],
            'previous_cycle' => $prev?->name,
            'kpis' => [
                'applications' => ['value' => $now['Applied'], 'previous' => $before['Applied'] ?? null],
                'interviewed' => ['value' => $now['Interviewed'], 'previous' => $before['Interviewed'] ?? null],
                'letters_sent' => ['value' => (clone $lettersSent)->count(), 'organisations' => (clone $lettersSent)->distinct('organisation_id')->count('organisation_id'),
                    'previous' => $prev ? DB::table('letters')->where('cycle_id', $prev->id)->where('status', 'sent')->count() : null],
                'final_years_not_completed' => ['value' => $finalNotDone, 'of' => $finalYears->count()],
            ],
            'outcomes' => [
                'accepted' => $p(['accepted', 'completed'])->count(),
                'awaiting' => $p(['letter_sent', 'acceptance_submitted'])->count(),
                'declined' => $p(['declined'])->count(),
            ],
            'queues' => [
                'to_interview' => DB::table('applications')->where('cycle_id', $cycle->id)->where('status', 'submitted')->count(),
                'orgs_to_check' => DB::table('organisations')->where('status', 'pending_check')->count(),
                'letters_ready' => DB::table('letters')->where('cycle_id', $cycle->id)->whereIn('status', ['generated', 'failed'])->count()
                    + DB::table('placements')->where('cycle_id', $cycle->id)->where('status', 'letter_pending')->whereNull('letter_id')->distinct('organisation_id')->count('organisation_id'),
                'acceptances_to_confirm' => $p(['acceptance_submitted'])->count(),
                'missing_completion' => $p(['accepted'])->where(fn ($q) => $q->whereNull('report_file_id')->orWhereNull('evaluation_file_id'))->count(),
                'ready_to_complete' => $p(['accepted'])->whereNotNull('report_file_id')->whereNotNull('evaluation_file_id')->count(),
            ],
            'spark' => $this->spark($cycle),
            'stages' => $this->stages($cycle->id),
            'by_programme' => ReportController::programmeStats($cycle->id),
            'by_level' => DB::table('applications as a')->join('student_profiles as s', 's.id', '=', 'a.student_profile_id')
                ->where('a.cycle_id', $cycle->id)->where('a.status', '<>', 'draft')->whereNotNull('s.level')
                ->groupBy('s.level')->orderBy('s.level')->selectRaw('s.level, count(*) as n')->get(),
            'by_week' => DB::table('applications')->where('cycle_id', $cycle->id)->whereNotNull('submitted_at')
                ->groupByRaw("date_trunc('week', submitted_at)")->orderByRaw("date_trunc('week', submitted_at)")
                ->selectRaw("to_char(date_trunc('week', submitted_at), 'YYYY-MM-DD') as week, count(*) as n")->get(),
            'top_organisations' => DB::table('placements as p')->join('organisations as o', 'o.id', '=', 'p.organisation_id')
                ->where('p.cycle_id', $cycle->id)->whereIn('p.status', ['accepted', 'completed'])
                ->groupBy('o.name')->selectRaw('o.name, count(*) as n')->orderByDesc('n')->limit(6)->get(),
            'lists' => [
                'acceptances' => DB::table('placements as p')->join('student_profiles as s', 's.id', '=', 'p.student_profile_id')->join('organisations as o', 'o.id', '=', 'p.organisation_id')
                    ->where('p.cycle_id', $cycle->id)->where('p.status', 'acceptance_submitted')->orderBy('p.reply_recorded_at')->limit(5)
                    ->get(['p.id', 's.full_name', 'o.name as organisation', 'p.acceptance_file_id', 'p.reply_recorded_at']),
                'orgs_to_check' => DB::table('organisations as o')->leftJoin('student_profiles as s', 's.id', '=', 'o.proposed_by_student_id')
                    ->where('o.status', 'pending_check')->orderBy('o.created_at')->limit(5)->get(['o.id', 'o.name', 's.full_name as proposed_by']),
                'awaiting_reply' => DB::table('placements as p')->join('letters as l', 'l.id', '=', 'p.letter_id')->join('student_profiles as s', 's.id', '=', 'p.student_profile_id')
                    ->join('organisations as o', 'o.id', '=', 'p.organisation_id')->where('p.status', 'letter_sent')->where('l.sent_at', '<', now()->subDays(14))
                    ->orderBy('l.sent_at')->limit(5)->get(['p.id', 's.full_name', 'o.name as organisation', 'l.sent_at', DB::raw('floor(extract(epoch from now() - l.sent_at) / 86400)::int as days')]),
            ],
        ]);
    }

    /**
     * Weekly counts for the KPI sparklines: the last (up to) 12 weeks of this cycle, zero-filled so every series
     * shares the same buckets. Each series is a real event timestamp, never interpolated.
     */
    private function spark(Cycle $cycle): array
    {
        $end = now()->startOfWeek();
        $start = $cycle->applications_open_at->copy()->startOfWeek();
        if ($start->lt($end->copy()->subWeeks(11))) {
            $start = $end->copy()->subWeeks(11);
        }
        $weeks = [];
        for ($w = $start->copy(); $w->lte($end); $w->addWeek()) {
            $weeks[] = $w->toDateString();
        }
        $series = function ($query, string $col) use ($start, $weeks): array {
            $rows = $query->where($col, '>=', $start)->groupByRaw("date_trunc('week', {$col})")
                ->selectRaw("to_char(date_trunc('week', {$col}), 'YYYY-MM-DD') as week, count(*) as n")->pluck('n', 'week');

            return array_map(fn ($w) => (int) ($rows[$w] ?? 0), $weeks);
        };

        return [
            'weeks' => $weeks,
            'applications' => $series(DB::table('applications')->where('cycle_id', $cycle->id)->whereNotNull('submitted_at'), 'submitted_at'),
            'interviewed' => $series(DB::table('applications')->where('cycle_id', $cycle->id)->whereIn('status', ['passed', 'not_recommended']), 'outcome_recorded_at'),
            'letters_sent' => $series(DB::table('letters')->where('cycle_id', $cycle->id)->where('status', 'sent'), 'sent_at'),
            'accepted' => $series(DB::table('placements')->where('cycle_id', $cycle->id)->whereIn('status', ['accepted', 'completed']), 'reply_recorded_at'),
        ];
    }

    /** Every known student by their stage in this cycle (one stage each), for the overview donut. */
    private function stages(int $cycleId): array
    {
        $rows = DB::select("
            select stage, count(*) as n from (
                select case
                    when a.id is null or a.status = 'draft' then 'not_started'
                    when a.status = 'submitted' then 'to_interview'
                    when a.status = 'not_recommended' then 'not_recommended'
                    when p.status is null or p.status = 'letter_pending' then 'matched'
                    when p.status in ('letter_sent', 'acceptance_submitted') then 'awaiting_reply'
                    when p.status = 'accepted' then 'accepted'
                    when p.status = 'completed' then 'completed'
                    else 'needs_rematch' end as stage
                from student_profiles s
                left join applications a on a.student_profile_id = s.id and a.cycle_id = ?
                left join lateral (select status from placements where application_id = a.id order by id desc limit 1) p on true
            ) x group by stage", [$cycleId]);

        $out = array_fill_keys(['not_started', 'to_interview', 'not_recommended', 'matched', 'awaiting_reply', 'accepted', 'needs_rematch', 'completed'], 0);
        foreach ($rows as $r) {
            $out[$r->stage] = (int) $r->n;
        }

        return $out;
    }
}
