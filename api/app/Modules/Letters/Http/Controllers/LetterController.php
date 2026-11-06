<?php

namespace App\Modules\Letters\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cycles\Models\Cycle;
use App\Modules\Files\FileService;
use App\Modules\Letters\LetterMail;
use App\Modules\Letters\LetterRenderer;
use App\Modules\Letters\Models\Letter;
use App\Modules\Letters\Models\LetterTemplate;
use App\Modules\Notifications\StudentMail;
use App\Modules\Placements\Models\Placement;
use App\Support\Audit;
use App\Support\Outbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

/** FR-L1–L11, BR4, BR5, AD7 (one request per letter; the browser loops with a progress bar). */
class LetterController extends Controller
{
    public function __construct(private readonly LetterRenderer $renderer, private readonly FileService $files) {}

    public function workspace(): JsonResponse
    {
        $cycle = Cycle::current();
        $letters = $cycle ? Letter::with(['organisation', 'placements.student.cv'])->where('cycle_id', $cycle->id)->orderByDesc('id')->get() : collect();
        $pool = $cycle ? Placement::with(['organisation:id,name', 'student:id,full_name'])->where('cycle_id', $cycle->id)->where('status', 'letter_pending')->whereNull('letter_id')->get() : collect();

        return response()->json([
            'cycle' => $cycle ? ['id' => $cycle->id, 'name' => $cycle->name, 'past_cutoff' => $cycle->isPastCutoff()] : null,
            'approved_template' => LetterTemplate::approved()?->version,
            'pool' => $pool->groupBy('organisation_id')->map(fn ($g) => ['organisation' => $g->first()->organisation->name, 'students' => $g->pluck('student.full_name')])->values(),
            'letters' => $letters->map(fn ($l) => $this->present($l)),
            'mail' => ['sent_today' => Outbox::sentToday(), 'daily_limit' => config('placement.mail_daily_limit')],
            'max_attachment_bytes' => config('placement.letters.max_attachment_bytes'),
        ]);
    }

    /** FR-L1: group every matched student without a letter by organisation (joining an existing unsent letter). */
    public function generate(Request $request): JsonResponse
    {
        $cycle = $this->workableCycle();
        $template = LetterTemplate::approved() ?? throw ValidationException::withMessages(['template' => 'No approved letter template yet (BR4). Ask the Head to send one to the President.']);

        $created = 0;
        DB::transaction(function () use ($cycle, $template, &$created) {
            $pool = Placement::where('cycle_id', $cycle->id)->where('status', 'letter_pending')->whereNull('letter_id')->lockForUpdate()->get()->groupBy('organisation_id');
            foreach ($pool as $orgId => $placements) {
                $letter = Letter::where('cycle_id', $cycle->id)->where('organisation_id', $orgId)->whereIn('status', ['generated', 'failed'])->first();
                if (! $letter) {
                    $seq = DB::selectOne("select nextval('letter_ref_seq') as n")->n;
                    $letter = Letter::create([
                        'reference_no' => sprintf('%s/%d/%04d', config('placement.letters.ref_prefix'), now()->year, $seq),
                        'cycle_id' => $cycle->id, 'organisation_id' => $orgId, 'template_id' => $template->id, 'issue_date' => today(),
                        'period_start' => $cycle->default_period_start, 'period_end' => $cycle->default_period_end, 'status' => 'generated',
                    ]);
                    $created++;
                }
                Placement::whereIn('id', $placements->pluck('id'))->update(['letter_id' => $letter->id]);
            }
        });

        return response()->json(['created' => $created]);
    }

    /** FR-L2: change the period on an unsent letter. */
    public function update(Request $request, Letter $letter): JsonResponse
    {
        $this->assertEditable($letter);
        $letter->update($request->validate([
            'period_start' => ['required', 'date'], 'period_end' => ['required', 'date', 'after_or_equal:period_start'],
        ]));

        return response()->json(['letter' => $this->present($letter->fresh(['organisation', 'placements.student.cv']))]);
    }

    /** FR-L2: remove a student from an unsent letter; they return to the pool. */
    public function removeStudent(Request $request, Letter $letter): JsonResponse
    {
        $this->assertEditable($letter);
        $pid = (int) $request->validate(['placement_id' => ['required', 'integer']])['placement_id'];
        $affected = Placement::whereKey($pid)->where('letter_id', $letter->id)->update(['letter_id' => null]);
        abort_unless($affected === 1, 404);
        if (! $letter->placements()->exists()) {
            $letter->delete();

            return response()->json(['deleted' => true]);
        }

        return response()->json(['letter' => $this->present($letter->fresh(['organisation', 'placements.student.cv']))]);
    }

    public function preview(Letter $letter): Response
    {
        return response($this->renderer->forLetter($letter), 200, ['Content-Type' => 'text/html; charset=UTF-8',
            'Content-Security-Policy' => "default-src 'none'; img-src data:; style-src 'unsafe-inline'"]);
    }

    public function pdf(Letter $letter): Response
    {
        $bytes = $letter->isSent() && $letter->pdf_file_id ? $this->files->contents($letter->pdf) : $this->renderer->pdf($this->renderer->forLetter($letter));

        return response($bytes, 200, ['Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.str_replace('/', '-', $letter->reference_no).'.pdf"']);
    }

    /** FR-L5/L6: send one letter by email (PDF + CVs). A failure marks it Failed, never Sent (NFR-R3). */
    public function send(Request $request, Letter $letter): JsonResponse
    {
        return DB::transaction(function () use ($request, $letter) {
            $letter = Letter::whereKey($letter->id)->lockForUpdate()->first(); // no double send
            $this->assertSendable($letter);
            if (Outbox::sentToday() >= config('placement.mail_daily_limit')) {
                throw ValidationException::withMessages(['mail' => 'The daily email limit ('.config('placement.mail_daily_limit').') is reached. Send the rest tomorrow, or download and send manually.']);
            }
            $letter->load(['organisation', 'placements.student.cv']);
            $email = $letter->organisation->email;
            $html = $this->renderer->forLetter($letter);
            $pdf = $this->renderer->pdf($html);
            $attachments = [['name' => str_replace('/', '-', $letter->reference_no).'.pdf', 'bytes' => $pdf, 'mime' => 'application/pdf']];
            foreach ($letter->placements as $p) {
                if ($p->student->cv) {
                    $attachments[] = ['name' => 'CV - '.preg_replace('/[^\w .-]/u', '', $p->student->full_name).'.pdf', 'bytes' => $this->files->contents($p->student->cv), 'mime' => 'application/pdf'];
                }
            }
            if (array_sum(array_map(fn ($a) => strlen($a['bytes']), $attachments)) > config('placement.letters.max_attachment_bytes')) {
                throw ValidationException::withMessages(['attachments' => 'Attachments exceed 20 MB. Remove a student or download the letter and send manually.']);
            }

            try {
                Mail::to($email)->send(new LetterMail($letter->reference_no, $letter->organisation->name, $attachments));
            } catch (Throwable $e) {
                Outbox::record($email, 'letter', 'failed', null, $e->getMessage());
                Letter::whereKey($letter->id)->update(['status' => 'failed', 'failure_reason' => mb_substr($e->getMessage(), 0, 500)]);
                report($e);

                return response()->json(['message' => 'Sending failed. The letter is marked Failed; retry when the mail service is available.', 'letter' => $this->present($letter->fresh(['organisation', 'placements.student.cv']))], 502);
            }
            Outbox::record($email, 'letter', 'sent');

            return response()->json(['letter' => $this->finaliseSent($letter, $pdf, 'system', $request)]);
        });
    }

    /** FR-L7: staff downloaded/printed and sent it themselves. */
    public function markSent(Request $request, Letter $letter): JsonResponse
    {
        return DB::transaction(function () use ($request, $letter) {
            $letter = Letter::whereKey($letter->id)->lockForUpdate()->first();
            $this->assertSendable($letter, requireEmail: false);
            $letter->load(['organisation', 'placements.student.cv']);
            $pdf = $this->renderer->pdf($this->renderer->forLetter($letter));

            return response()->json(['letter' => $this->finaliseSent($letter, $pdf, 'manual', $request)]);
        });
    }

    private function finaliseSent(Letter $letter, string $pdf, string $mode, Request $request): array
    {
        $file = $this->files->put('letter_pdf', 'application/pdf', str_replace('/', '-', $letter->reference_no).'.pdf', $pdf, $request->user());
        $letter->update(['status' => 'sent', 'send_mode' => $mode, 'recipient_email' => $letter->organisation->email,
            'addressee_snapshot' => $this->renderer->addressee($letter), 'pdf_file_id' => $file->id,
            'sent_by' => $request->user()->id, 'sent_at' => now(), 'failure_reason' => null]);
        Placement::where('letter_id', $letter->id)->update(['status' => 'letter_sent']);
        Audit::log('letter.sent', $letter, ['reference' => $letter->reference_no, 'mode' => $mode, 'students' => $letter->placements->count()]);

        foreach ($letter->placements as $p) {
            StudentMail::send($p->student, 'letter_sent', 'Your introductory letter was sent', [
                "Career Services sent your introductory letter ({$letter->reference_no}) to **{$letter->organisation->name}**.",
                'You can view a copy on your placement page. When the organisation replies, record their answer there.',
            ]);
        }

        return $this->present($letter->fresh(['organisation', 'placements.student.cv']));
    }

    private function workableCycle(): Cycle
    {
        $cycle = Cycle::current() ?? throw ValidationException::withMessages(['cycle' => 'There is no cycle.']);
        if ($cycle->isPastCutoff()) {
            throw ValidationException::withMessages(['cycle' => "{$cycle->name} is past its letter cut-off (BR5)."]);
        }

        return $cycle;
    }

    private function assertEditable(Letter $letter): void
    {
        if ($letter->isSent()) {
            throw ValidationException::withMessages(['letter' => 'A sent letter cannot be changed.']);
        }
    }

    private function assertSendable(Letter $letter, bool $requireEmail = true): void
    {
        $this->assertEditable($letter);
        if ($letter->cycle->isPastCutoff()) {
            throw ValidationException::withMessages(['cycle' => 'This cycle is past its letter cut-off (BR5).']);
        }
        if (! LetterTemplate::approved()) {
            throw ValidationException::withMessages(['template' => 'No approved letter template (BR4).']);
        }
        if (! $letter->placements()->exists()) {
            throw ValidationException::withMessages(['letter' => 'This letter has no students.']);
        }
        if ($requireEmail && ! $letter->organisation->email) {
            throw ValidationException::withMessages(['email' => 'This organisation has no email. Download and send manually.']);
        }
        // Use the currently approved version for anything still unsent (D6).
        $approved = LetterTemplate::approved();
        if ($letter->template_id !== $approved->id) {
            $letter->update(['template_id' => $approved->id]);
            $letter->setRelation('template', $approved);
        }
    }

    private function present(Letter $l): array
    {
        $attach = $l->placements->sum(fn ($p) => $p->student->cv?->size_bytes ?? 0);

        return [
            'id' => $l->id, 'reference_no' => $l->reference_no, 'status' => $l->status, 'send_mode' => $l->send_mode,
            'organisation' => ['id' => $l->organisation->id, 'name' => $l->organisation->name, 'email' => $l->organisation->email],
            'period_start' => $l->period_start->toDateString(), 'period_end' => $l->period_end->toDateString(),
            'sent_at' => $l->sent_at?->toIso8601String(), 'failure_reason' => $l->failure_reason,
            'attachment_bytes' => $attach,
            'students' => $l->placements->map(fn ($p) => ['placement_id' => $p->id, 'name' => $p->student->full_name, 'programme' => $p->student->programme,
                'level' => $p->student->level, 'has_cv' => (bool) $p->student->cv_file_id])->values(),
        ];
    }
}
