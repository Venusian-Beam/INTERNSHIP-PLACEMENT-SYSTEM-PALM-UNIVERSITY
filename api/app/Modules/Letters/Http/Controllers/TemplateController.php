<?php

namespace App\Modules\Letters\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Files\FileService;
use App\Modules\Letters\LetterRenderer;
use App\Modules\Letters\Models\LetterTemplate;
use App\Modules\Letters\TemplateSanitizer;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Smalot\PdfParser\Parser as PdfParser;

/** FR-T1–T5, D4, D6: Head drafts and submits; the President approves or leaves remarks. Letters use the approved version. */
class TemplateController extends Controller
{
    public function __construct(private readonly LetterRenderer $renderer) {}

    /** Head view: approved version, the working draft (if any), history, placeholders, signature status. */
    public function index(): JsonResponse
    {
        $versions = LetterTemplate::orderByDesc('version')->get();
        $working = $versions->first(fn ($t) => in_array($t->status, ['draft', 'with_president', 'remarks'], true));

        return response()->json([
            'approved' => ($a = $versions->firstWhere('status', 'approved')) ? $this->present($a) : null,
            'working' => $working ? $this->present($working) : null,
            'history' => $versions->map(fn ($t) => $this->present($t, false)),
            'placeholders' => LetterRenderer::PLACEHOLDERS,
            'has_signature' => DB::table('settings')->where('key', 'signature_file_id')->exists(),
            'default_body' => LetterRenderer::DEFAULT_BODY,
        ]);
    }

    /** Save the working draft. Revising after remarks starts a new version (D6: the approved one stays in force). */
    public function saveDraft(Request $request, FileService $files): JsonResponse
    {
        $in = $request->validate([
            'format' => ['sometimes', 'in:text,html'],
            'body' => ['required', 'string', 'max:'.TemplateSanitizer::MAX_BYTES],
            'source_file_id' => ['sometimes', 'nullable', 'integer'],
        ]);
        $format = $in['format'] ?? 'text';
        if ($format === 'html') {
            // Uploaded + edited document: never trust the browser's HTML (TemplateSanitizer).
            $body = TemplateSanitizer::clean($in['body']);
            if (trim(strip_tags($body, '<img>')) === '') {
                throw ValidationException::withMessages(['body' => 'The document is empty.']);
            }
        } else {
            $body = $in['body'];
            if (strlen($body) > 10000) {
                throw ValidationException::withMessages(['body' => 'The template text is too long.']);
            }
            LetterRenderer::validateBody($body);
        }
        $sourceId = ! empty($in['source_file_id']) ? $files->ownReadyFile($request->user(), (int) $in['source_file_id'], 'template_source')->id : null;

        $t = DB::transaction(function () use ($body, $format, $sourceId, $request) {
            $working = LetterTemplate::whereIn('status', ['draft', 'with_president', 'remarks'])->lockForUpdate()->orderByDesc('version')->first();
            if ($working?->status === 'with_president') {
                throw ValidationException::withMessages(['body' => 'This version is with the President. Wait for a decision before editing.']);
            }
            if ($working?->status === 'draft') {
                $working->update(['body' => $body, 'format' => $format, 'source_file_id' => $sourceId ?? $working->source_file_id]);

                return $working;
            }

            // QA-3-01: a rejected version keeps its "remarks" status so the President's decision history stays accurate;
            // the revision simply starts the next version.
            return LetterTemplate::create([
                'version' => (int) LetterTemplate::max('version') + 1, 'body' => $body, 'format' => $format, 'source_file_id' => $sourceId,
                'status' => 'draft', 'created_by' => $request->user()->id,
            ]);
        });
        Audit::log('template.saved', $t, ['version' => $t->version, 'format' => $format, 'source_file_id' => $t->source_file_id]);

        return response()->json(['template' => $this->present($t)]);
    }

    /**
     * Uploaded PDF → editable text (FR-T1). Word files are converted in the browser; a PDF has no reliable
     * structure to convert, so only its text comes across, as paragraphs, for the Head to tidy in the editor.
     */
    public function import(Request $request, FileService $files): JsonResponse
    {
        $file = $files->ownReadyFile($request->user(), (int) $request->validate(['file_id' => ['required', 'integer']])['file_id'], 'template_source');
        if ($file->mime !== 'application/pdf') {
            throw ValidationException::withMessages(['file_id' => 'Only PDF files are converted here. Word files open directly in the editor.']);
        }
        try {
            $text = (new PdfParser)->parseContent($files->contents($file))->getText();
        } catch (\Throwable) {
            throw ValidationException::withMessages(['file_id' => "We couldn't read this PDF. Upload the Word version instead."]);
        }
        $text = trim(preg_replace("/[ \t]+\n/", "\n", str_replace(["\r\n", "\r", "\f"], "\n", $text)));
        if ($text === '') {
            throw ValidationException::withMessages(['file_id' => 'This PDF has no readable text (it may be a scan). Upload the Word version instead.']);
        }
        $paragraphs = preg_split("/\n{2,}/", $text);
        $html = implode('', array_map(fn ($p) => '<p>'.nl2br(e(trim($p)), false).'</p>', array_filter($paragraphs, fn ($p) => trim($p) !== '')));

        return response()->json(['html' => TemplateSanitizer::clean($html)]);
    }

    public function submit(Request $request, LetterTemplate $template): JsonResponse
    {
        if ($template->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only a draft can be sent to the President.']);
        }
        $missing = LetterRenderer::missingForSubmit($template->body, $template->format);
        if ($missing) {
            throw ValidationException::withMessages(['status' => 'Before sending to the President, add '.implode(', ', $missing).'.']);
        }
        $template->update(['status' => 'with_president', 'submitted_by' => $request->user()->id, 'submitted_at' => now(), 'remarks' => null]);
        Audit::log('template.submitted', $template, ['version' => $template->version]);

        return response()->json(['template' => $this->present($template)]);
    }

    /** President: the version waiting for a decision (if any) and history. */
    public function pending(): JsonResponse
    {
        $p = LetterTemplate::where('status', 'with_president')->first();

        return response()->json([
            'pending' => $p ? $this->present($p) : null,
            'approved_version' => LetterTemplate::approved()?->version,
            'history' => LetterTemplate::whereNotNull('decided_at')->orderByDesc('decided_at')->limit(20)->get()->map(fn ($t) => $this->present($t, false)),
        ]);
    }

    public function approve(Request $request, LetterTemplate $template): JsonResponse
    {
        DB::transaction(function () use ($template, $request) {
            $t = LetterTemplate::whereKey($template->id)->lockForUpdate()->first();
            if ($t->status !== 'with_president') {
                throw ValidationException::withMessages(['status' => 'This version is not waiting for approval.']);
            }
            LetterTemplate::where('status', 'approved')->update(['status' => 'superseded']);
            $t->update(['status' => 'approved', 'decided_by' => $request->user()->id, 'decided_at' => now()]);
        });
        Audit::log('template.approved', $template, ['version' => $template->version]);

        return response()->json(['template' => $this->present($template->fresh())]);
    }

    public function remarks(Request $request, LetterTemplate $template): JsonResponse
    {
        $remarks = $request->validate(['remarks' => ['required', 'string', 'min:3', 'max:2000']])['remarks'];
        $updated = LetterTemplate::whereKey($template->id)->where('status', 'with_president')
            ->update(['status' => 'remarks', 'remarks' => $remarks, 'decided_by' => $request->user()->id, 'decided_at' => now()]);
        if (! $updated) {
            throw ValidationException::withMessages(['status' => 'This version is not waiting for a decision.']);
        }
        Audit::log('template.remarked', $template, ['version' => $template->version]);

        return response()->json(['template' => $this->present($template->fresh())]);
    }

    /** HTML preview with sample data (shown in a sandboxed iframe). */
    public function preview(LetterTemplate $template): Response
    {
        return response($this->renderer->sample($template->body, $template->format), 200, ['Content-Type' => 'text/html; charset=UTF-8', 'Content-Security-Policy' => "default-src 'none'; img-src data:; style-src 'unsafe-inline'"]);
    }

    /** NFR-S7: the signature is stored privately and only ever used inside the PDF renderer. */
    public function setSignature(Request $request, FileService $files): JsonResponse
    {
        $file = $files->ownReadyFile($request->user(), (int) $request->validate(['file_id' => ['required', 'integer']])['file_id'], 'signature');
        DB::table('settings')->updateOrInsert(['key' => 'signature_file_id'], ['value' => json_encode($file->id), 'updated_at' => now(), 'created_at' => now()]);
        Audit::log('signature.uploaded', $file);

        return response()->json(['message' => 'Signature saved.']);
    }

    private function present(LetterTemplate $t, bool $withBody = true): array
    {
        return array_filter([
            'id' => $t->id, 'version' => $t->version, 'status' => $t->status, 'remarks' => $t->remarks, 'format' => $t->format,
            'submitted_at' => $t->submitted_at?->toIso8601String(), 'decided_at' => $t->decided_at?->toIso8601String(),
            'source_name' => $t->source_file_id ? $t->sourceFile?->original_name : null,
            'body' => $withBody ? $t->body : null,
        ], fn ($v) => $v !== null);
    }
}
