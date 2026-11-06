<?php

use App\Modules\Applications\Http\Controllers\ApplicationController;
use App\Modules\Applications\Http\Controllers\StudentApplicationController;
use App\Modules\Audit\Http\Controllers\AuditController;
use App\Modules\Cycles\Http\Controllers\CycleController;
use App\Modules\Dashboard\Http\Controllers\DashboardController;
use App\Modules\Files\Http\Controllers\FileController;
use App\Modules\Identity\Http\Controllers\AuthController;
use App\Modules\Identity\Http\Controllers\StaffAccountController;
use App\Modules\Letters\Http\Controllers\LetterController;
use App\Modules\Letters\Http\Controllers\TemplateController;
use App\Modules\Organisations\Http\Controllers\OrganisationController;
use App\Modules\Placements\Http\Controllers\PlacementController;
use App\Modules\Reports\Http\Controllers\ReportController;
use App\Modules\Students\Http\Controllers\RegistryController;
use App\Modules\Students\Http\Controllers\StudentController;
use Illuminate\Support\Facades\Route;

/*
 * JSON API, consumed only by the Next.js server-side proxy (AD8).
 * Route middleware gives the coarse role gate; Policies/Actions enforce record-level rules.
 */

// QA-4-02: route-bound IDs must be numeric and fit a bigint, so junk like "abc" is a clean 404 instead of a SQL error.
Route::patterns(array_fill_keys(['student', 'file', 'letter', 'application', 'placement', 'organisation', 'cycle', 'template', 'user', 'id'], '[0-9]{1,18}'));

// ---- Identity (public) ----
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:register');
    Route::get('verify-email/{id}/{hash}', [AuthController::class, 'verifyEmail'])->name('verification.verify')->middleware('throttle:register');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('otp', [AuthController::class, 'verifyOtp'])->middleware('throttle:otp');
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password');
    Route::post('accept-invite', [AuthController::class, 'acceptInvite'])->middleware('throttle:password');
});

// ---- Authenticated ----
Route::middleware(['auth:sanctum', 'role'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    // Files (FR-X3): presigned upload, confirm, permission-checked download link
    Route::post('files/uploads', [FileController::class, 'presign'])->middleware('throttle:uploads');
    Route::post('files/{file}/confirm', [FileController::class, 'confirm']);
    Route::get('files/{file}/download', [FileController::class, 'download']);

    Route::get('cycles/current', [CycleController::class, 'current']);

    // Student only (always scoped to the signed-in student's own profile)
    Route::middleware('role:student')->prefix('student')->group(function () {
        Route::patch('profile', [StudentController::class, 'updateOwn']);
        Route::get('application', [StudentApplicationController::class, 'show']);
        Route::put('application', [StudentApplicationController::class, 'saveDraft']);
        Route::post('application/submit', [StudentApplicationController::class, 'submit']);
        Route::post('organisations', [OrganisationController::class, 'propose']);
        Route::post('placements/{placement}/reply', [PlacementController::class, 'studentReply']);
        Route::post('placements/{placement}/report', [PlacementController::class, 'studentReport']);
    });

    // President only (D3): the template version waiting for a decision.
    Route::middleware('role:president')->prefix('president')->group(function () {
        Route::get('template', [TemplateController::class, 'pending']);
        Route::post('template/{template}/approve', [TemplateController::class, 'approve']);
        Route::post('template/{template}/remarks', [TemplateController::class, 'remarks']);
    });

    // Template preview: Head and President
    Route::get('letter-template/{template}/preview', [TemplateController::class, 'preview'])->middleware('role:head,president');

    // Students and Career Services
    Route::middleware('role:student,staff,head')->group(function () {
        Route::get('organisations', [OrganisationController::class, 'index']);
        Route::get('organisations/similar', [OrganisationController::class, 'similar']);
    });

    // Career Services (staff + Head)
    Route::middleware('role:staff,head')->group(function () {
        Route::get('cycles', [CycleController::class, 'index']);
        Route::get('students', [StudentController::class, 'index']);
        Route::get('students/{student}', [StudentController::class, 'show']);
        Route::post('organisations', [OrganisationController::class, 'store']);
        Route::patch('organisations/{organisation}', [OrganisationController::class, 'update']);
        Route::get('organisations-queue', [OrganisationController::class, 'queue']);
        Route::post('organisations/{organisation}/approve', [OrganisationController::class, 'approve']);
        Route::post('organisations/{organisation}/reject', [OrganisationController::class, 'reject']);
        Route::post('organisations/{organisation}/merge', [OrganisationController::class, 'merge']);
        Route::get('applications', [ApplicationController::class, 'index']);
        Route::get('applications/{application}', [ApplicationController::class, 'show']);
        Route::post('applications/{application}/outcome', [ApplicationController::class, 'recordOutcome']);
        Route::post('applications/late-admit', [ApplicationController::class, 'admitLate']);

        // Letters (FR-L)
        Route::get('letters/workspace', [LetterController::class, 'workspace']);
        Route::post('letters/generate', [LetterController::class, 'generate']);
        Route::patch('letters/{letter}', [LetterController::class, 'update']);
        Route::post('letters/{letter}/remove-student', [LetterController::class, 'removeStudent']);
        Route::get('letters/{letter}/preview', [LetterController::class, 'preview']);
        Route::get('letters/{letter}/pdf', [LetterController::class, 'pdf']);
        Route::post('letters/{letter}/send', [LetterController::class, 'send']);
        Route::post('letters/{letter}/mark-sent', [LetterController::class, 'markSent']);

        // Placements (FR-PL)
        Route::get('placements', [PlacementController::class, 'index']);

        // Dashboard + reports (FR-D1, FR-R1–R6)
        Route::get('dashboard', [DashboardController::class, 'index']);
        Route::get('reports/pipeline', [ReportController::class, 'pipeline']);
        Route::get('reports/graduation', [ReportController::class, 'graduation']);
        Route::get('reports/organisations', [ReportController::class, 'organisations']);
        Route::get('reports/programmes', [ReportController::class, 'programmes']);
        Route::post('placements/rematch', [PlacementController::class, 'rematch']);
        Route::post('placements/{placement}/reply', [PlacementController::class, 'staffReply']);
        Route::post('placements/{placement}/confirm', [PlacementController::class, 'confirm']);
        Route::post('placements/{placement}/reject-acceptance', [PlacementController::class, 'rejectAcceptance']);
        Route::post('placements/{placement}/evaluation', [PlacementController::class, 'evaluation']);
    });

    // Head only
    Route::middleware('role:head')->group(function () {
        Route::get('staff/accounts', [StaffAccountController::class, 'index']);
        Route::post('staff/invitations', [StaffAccountController::class, 'invite']);
        Route::patch('staff/accounts/{user}', [StaffAccountController::class, 'update']);
        Route::post('cycles', [CycleController::class, 'store']);
        Route::patch('cycles/{cycle}', [CycleController::class, 'update']);
        Route::post('registry/preview', [RegistryController::class, 'preview']);
        Route::post('registry/import', [RegistryController::class, 'import']);
        Route::get('audit', [AuditController::class, 'index']);
        Route::get('letter-template', [TemplateController::class, 'index']);
        Route::put('letter-template/draft', [TemplateController::class, 'saveDraft']);
        Route::post('letter-template/{template}/submit', [TemplateController::class, 'submit']);
        Route::post('letter-template/signature', [TemplateController::class, 'setSignature']);
        Route::post('letter-template/import', [TemplateController::class, 'import'])->middleware('throttle:uploads');
        Route::post('placements/{placement}/complete', [PlacementController::class, 'complete']);
    });
});
