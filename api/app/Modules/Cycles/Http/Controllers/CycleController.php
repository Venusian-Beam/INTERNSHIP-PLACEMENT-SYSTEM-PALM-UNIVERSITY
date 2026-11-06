<?php

namespace App\Modules\Cycles\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cycles\Models\Cycle;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** FR-C1–C3. Reading is open to any signed-in user; changes are Head-only (route middleware, UI-D8). */
class CycleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['cycles' => Cycle::orderByDesc('applications_open_at')->get()->map(fn ($c) => self::present($c))]);
    }

    public function current(): JsonResponse
    {
        $c = Cycle::current();

        return response()->json(['cycle' => $c ? self::present($c) : null]);
    }

    public function store(Request $request): JsonResponse
    {
        $cycle = Cycle::create($this->validated($request));
        Audit::log('cycle.created', $cycle);

        return response()->json(['cycle' => self::present($cycle)], 201);
    }

    public function update(Request $request, Cycle $cycle): JsonResponse
    {
        $cycle->update($this->validated($request, $cycle));
        Audit::log('cycle.updated', $cycle);

        return response()->json(['cycle' => self::present($cycle)]);
    }

    private function validated(Request $request, ?Cycle $cycle = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('cycles', 'name')->ignore($cycle?->id)],
            'applications_open_at' => ['required', 'date'],
            'applications_close_at' => ['required', 'date', 'after:applications_open_at'],
            'letter_cutoff_at' => ['required', 'date', 'after_or_equal:applications_close_at'],
            'default_period_start' => ['required', 'date'],
            'default_period_end' => ['required', 'date', 'after_or_equal:default_period_start'],
        ]);
    }

    public static function present(Cycle $c): array
    {
        return [
            'id' => $c->id, 'name' => $c->name,
            'applications_open_at' => $c->applications_open_at->toIso8601String(),
            'applications_close_at' => $c->applications_close_at->toIso8601String(),
            'letter_cutoff_at' => $c->letter_cutoff_at->toIso8601String(),
            'default_period_start' => $c->default_period_start->toDateString(),
            'default_period_end' => $c->default_period_end->toDateString(),
            'is_open' => $c->isOpenForApplications(), 'past_cutoff' => $c->isPastCutoff(),
        ];
    }
}
