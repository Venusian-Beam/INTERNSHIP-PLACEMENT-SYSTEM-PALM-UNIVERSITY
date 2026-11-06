<?php

namespace App\Modules\Students;

use App\Modules\Applications\Models\Application;
use App\Modules\Placements\Models\Placement;
use App\Modules\Students\Models\StudentProfile;

/**
 * A student's overall stage (docs/05 "A student's overall stage"), used in lists, the student home page and reports.
 * Completed wins over everything (graduation requirement met once, D13).
 */
class StageResolver
{
    public const LABELS = [
        'not_started' => 'Not started', 'draft' => 'Draft', 'applied' => 'Applied', 'not_recommended' => 'Not recommended',
        'matched' => 'Matched', 'letter_sent' => 'Letter sent', 'acceptance_submitted' => 'Acceptance submitted',
        'accepted' => 'Accepted', 'needs_rematch' => 'Needs re-match', 'completed' => 'Completed',
    ];

    public static function for(StudentProfile $student, ?int $cycleId = null): string
    {
        if (Placement::where('student_profile_id', $student->id)->where('status', 'completed')->exists()) {
            return 'completed';
        }
        $app = Application::where('student_profile_id', $student->id)
            ->when($cycleId, fn ($q) => $q->where('cycle_id', $cycleId))
            ->orderByDesc('cycle_id')->first();

        return self::fromApplication($app);
    }

    public static function fromApplication(?Application $app): string
    {
        if (! $app) {
            return 'not_started';
        }
        if ($app->status !== 'passed') {
            return ['draft' => 'draft', 'submitted' => 'applied', 'not_recommended' => 'not_recommended'][$app->status];
        }
        $open = $app->placements()->where('status', '!=', 'declined')->latest('id')->first();
        if (! $open) {
            return 'needs_rematch';
        }

        return match ($open->status) {
            'letter_pending' => 'matched',
            'letter_sent' => 'letter_sent',
            'acceptance_submitted' => 'acceptance_submitted',
            'accepted' => 'accepted',
            'completed' => 'completed',
            default => 'matched',
        };
    }
}
