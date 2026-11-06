<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Full placement schema (docs/09-database-design.md).
 * Statuses are text + CHECK constraints; database-level guards enforce the rules that must never be bypassed:
 * one application per student per cycle (BR1), one approved template (BR4), sent letters immutable (BR5),
 * one open placement per application, insert-only audit log (AD16).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student','staff','head','president'))");

        Schema::create('invitations', function (Blueprint $t) {
            $t->id();
            $t->string('email');
            $t->string('name');
            $t->string('role', 20);
            $t->string('token_hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamp('accepted_at')->nullable();
            $t->foreignId('invited_by')->constrained('users');
            $t->timestamps();
        });
        DB::statement("ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('staff','head','president'))");

        Schema::create('otp_codes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('challenge_hash', 64)->unique();
            $t->string('code_hash');
            $t->timestamp('expires_at');
            $t->timestamp('consumed_at')->nullable();
            $t->unsignedSmallInteger('attempts')->default(0);
            $t->timestamps();
        });

        Schema::create('files', function (Blueprint $t) {
            $t->id();
            $t->string('kind', 20);
            $t->string('storage_key')->unique();
            $t->string('original_name');
            $t->string('mime', 100);
            $t->unsignedBigInteger('size_bytes');
            $t->string('status', 10)->default('pending');
            $t->foreignId('uploaded_by')->nullable()->constrained('users');
            $t->timestamp('deleted_at')->nullable();
            $t->timestamps();
        });
        DB::statement("ALTER TABLE files ADD CONSTRAINT files_kind_check CHECK (kind IN ('cv','letter_pdf','acceptance','report','evaluation','signature','registry_csv'))");
        DB::statement("ALTER TABLE files ADD CONSTRAINT files_status_check CHECK (status IN ('pending','ready'))");

        Schema::create('student_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $t->string('university_email')->unique();
            $t->string('full_name');
            $t->string('student_number', 40)->nullable()->unique();
            $t->string('programme')->nullable();
            $t->unsignedSmallInteger('level')->nullable();
            $t->string('phone', 40)->nullable();
            $t->unsignedSmallInteger('expected_grad_year')->nullable();
            $t->boolean('on_registry')->default(false);
            $t->foreignId('cv_file_id')->nullable()->constrained('files');
            $t->timestamp('documents_purged_at')->nullable();
            $t->timestamps();
            $t->index('programme');
        });

        Schema::create('cycles', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->timestamp('applications_open_at');
            $t->timestamp('applications_close_at');
            $t->timestamp('letter_cutoff_at');
            $t->date('default_period_start');
            $t->date('default_period_end');
            $t->timestamps();
        });
        DB::statement('ALTER TABLE cycles ADD CONSTRAINT cycles_dates_check CHECK (applications_open_at < applications_close_at AND applications_close_at <= letter_cutoff_at AND default_period_start <= default_period_end)');

        Schema::create('organisations', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('address')->nullable();
            $t->string('email')->nullable();
            $t->string('contact_person')->nullable();
            $t->string('contact_title')->nullable();
            $t->string('phone', 40)->nullable();
            $t->string('sector')->nullable();
            $t->string('status', 20)->default('active');
            $t->text('rejection_reason')->nullable();
            $t->foreignId('merged_into_id')->nullable()->constrained('organisations');
            $t->foreignId('proposed_by_student_id')->nullable()->constrained('student_profiles')->nullOnDelete();
            $t->foreignId('checked_by')->nullable()->constrained('users');
            $t->timestamp('checked_at')->nullable();
            $t->timestamps();
            $t->index('status');
        });
        DB::statement("ALTER TABLE organisations ADD CONSTRAINT organisations_status_check CHECK (status IN ('pending_check','active','rejected','merged'))");
        DB::statement("ALTER TABLE organisations ADD CONSTRAINT organisations_active_email_check CHECK (status <> 'active' OR email IS NOT NULL)");
        DB::statement('CREATE INDEX organisations_name_trgm ON organisations USING gin (name gin_trgm_ops)');

        Schema::create('applications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('student_profile_id')->constrained();
            $t->foreignId('cycle_id')->constrained();
            $t->string('status', 20)->default('draft');
            $t->text('motivation')->nullable();
            $t->timestamp('submitted_at')->nullable();
            $t->foreignId('late_admitted_by')->nullable()->constrained('users');
            $t->date('interview_date')->nullable();
            $t->text('interview_notes')->nullable();
            $t->foreignId('matched_organisation_id')->nullable()->constrained('organisations');
            $t->foreignId('outcome_recorded_by')->nullable()->constrained('users');
            $t->timestamp('outcome_recorded_at')->nullable();
            $t->timestamps();
            $t->unique(['student_profile_id', 'cycle_id']);
            $t->index(['cycle_id', 'status']);
        });
        DB::statement("ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN ('draft','submitted','passed','not_recommended'))");
        DB::statement("ALTER TABLE applications ADD CONSTRAINT applications_passed_match_check CHECK (status <> 'passed' OR matched_organisation_id IS NOT NULL)");

        Schema::create('application_choices', function (Blueprint $t) {
            $t->id();
            $t->foreignId('application_id')->constrained()->cascadeOnDelete();
            $t->unsignedSmallInteger('rank');
            $t->foreignId('organisation_id')->constrained();
            $t->timestamps();
            $t->unique(['application_id', 'rank']);
            $t->unique(['application_id', 'organisation_id']);
        });
        DB::statement('ALTER TABLE application_choices ADD CONSTRAINT application_choices_rank_check CHECK (rank BETWEEN 1 AND 3)');

        Schema::create('letter_templates', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('version')->unique();
            $t->text('body');
            $t->string('status', 20)->default('draft');
            $t->foreignId('created_by')->constrained('users');
            $t->foreignId('submitted_by')->nullable()->constrained('users');
            $t->timestamp('submitted_at')->nullable();
            $t->foreignId('decided_by')->nullable()->constrained('users');
            $t->timestamp('decided_at')->nullable();
            $t->text('remarks')->nullable();
            $t->timestamps();
        });
        DB::statement("ALTER TABLE letter_templates ADD CONSTRAINT letter_templates_status_check CHECK (status IN ('draft','with_president','approved','remarks','superseded'))");
        DB::statement("CREATE UNIQUE INDEX letter_templates_one_approved ON letter_templates ((status)) WHERE status = 'approved'");

        DB::statement('CREATE SEQUENCE IF NOT EXISTS letter_ref_seq START 1');
        Schema::create('letters', function (Blueprint $t) {
            $t->id();
            $t->string('reference_no', 60)->unique();
            $t->foreignId('cycle_id')->constrained();
            $t->foreignId('organisation_id')->constrained();
            $t->foreignId('template_id')->constrained('letter_templates');
            $t->date('issue_date');
            $t->date('period_start');
            $t->date('period_end');
            $t->string('status', 20)->default('generated');
            $t->string('send_mode', 10)->nullable();
            $t->string('recipient_email')->nullable();
            $t->jsonb('addressee_snapshot')->nullable();
            $t->foreignId('pdf_file_id')->nullable()->constrained('files');
            $t->foreignId('sent_by')->nullable()->constrained('users');
            $t->timestamp('sent_at')->nullable();
            $t->text('failure_reason')->nullable();
            $t->timestamps();
            $t->index(['cycle_id', 'status']);
        });
        DB::statement("ALTER TABLE letters ADD CONSTRAINT letters_status_check CHECK (status IN ('generated','sent','failed'))");
        DB::statement("ALTER TABLE letters ADD CONSTRAINT letters_send_mode_check CHECK (send_mode IS NULL OR send_mode IN ('system','manual'))");
        DB::statement('ALTER TABLE letters ADD CONSTRAINT letters_period_check CHECK (period_start <= period_end)');
        // BR5: a sent letter can never change or be deleted.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION letters_immutable_when_sent() RETURNS trigger AS $$
            BEGIN
              IF OLD.status = 'sent' THEN
                RAISE EXCEPTION 'letter % is sent and cannot be changed', OLD.reference_no USING ERRCODE = 'check_violation';
              END IF;
              IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
              RETURN NEW;
            END $$ LANGUAGE plpgsql;
            CREATE TRIGGER letters_immutable BEFORE UPDATE OR DELETE ON letters
              FOR EACH ROW EXECUTE FUNCTION letters_immutable_when_sent();
        SQL);

        Schema::create('placements', function (Blueprint $t) {
            $t->id();
            $t->foreignId('application_id')->constrained();
            $t->foreignId('student_profile_id')->constrained();
            $t->foreignId('organisation_id')->constrained();
            $t->foreignId('cycle_id')->constrained();
            $t->foreignId('letter_id')->nullable()->constrained();
            $t->string('status', 25)->default('letter_pending');
            $t->foreignId('reply_recorded_by')->nullable()->constrained('users');
            $t->timestamp('reply_recorded_at')->nullable();
            $t->foreignId('acceptance_file_id')->nullable()->constrained('files');
            $t->foreignId('acceptance_confirmed_by')->nullable()->constrained('users');
            $t->timestamp('acceptance_confirmed_at')->nullable();
            $t->foreignId('report_file_id')->nullable()->constrained('files');
            $t->foreignId('evaluation_file_id')->nullable()->constrained('files');
            $t->foreignId('completed_by')->nullable()->constrained('users');
            $t->timestamp('completed_at')->nullable();
            $t->timestamps();
            $t->index('status');
            $t->index('student_profile_id');
        });
        DB::statement("ALTER TABLE placements ADD CONSTRAINT placements_status_check CHECK (status IN ('letter_pending','letter_sent','acceptance_submitted','accepted','declined','completed'))");
        DB::statement("CREATE UNIQUE INDEX placements_one_open ON placements (application_id) WHERE status NOT IN ('declined')");

        Schema::create('audit_log', function (Blueprint $t) {
            $t->id();
            $t->foreignId('actor_user_id')->nullable()->constrained('users');
            $t->string('action', 60);
            $t->string('subject_type', 40)->nullable();
            $t->unsignedBigInteger('subject_id')->nullable();
            $t->jsonb('metadata')->nullable();
            $t->string('ip', 45)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['subject_type', 'subject_id']);
            $t->index('action');
        });
        // AD16: audit entries are insert-only.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION audit_log_insert_only() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'audit_log is insert-only' USING ERRCODE = 'insufficient_privilege'; END $$ LANGUAGE plpgsql;
            CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log
              FOR EACH ROW EXECUTE FUNCTION audit_log_insert_only();
        SQL);

        Schema::create('email_log', function (Blueprint $t) {
            $t->id();
            $t->string('to_email');
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('type', 40);
            $t->string('status', 10);
            $t->text('error')->nullable();
            $t->timestamp('sent_at')->useCurrent();
            $t->index('sent_at');
        });

        Schema::create('registry_imports', function (Blueprint $t) {
            $t->id();
            $t->foreignId('imported_by')->constrained('users');
            $t->unsignedInteger('rows_total')->default(0);
            $t->unsignedInteger('rows_created')->default(0);
            $t->unsignedInteger('rows_updated')->default(0);
            $t->unsignedInteger('rows_failed')->default(0);
            $t->jsonb('errors')->nullable();
            $t->timestamps();
        });

        Schema::create('settings', function (Blueprint $t) {
            $t->string('key', 60)->primary();
            $t->jsonb('value')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log; DROP FUNCTION IF EXISTS audit_log_insert_only();');
        DB::unprepared('DROP TRIGGER IF EXISTS letters_immutable ON letters; DROP FUNCTION IF EXISTS letters_immutable_when_sent();');
        foreach (['settings', 'registry_imports', 'email_log', 'audit_log', 'placements', 'letters', 'letter_templates',
            'application_choices', 'applications', 'organisations', 'cycles', 'student_profiles', 'files', 'otp_codes', 'invitations'] as $table) {
            Schema::dropIfExists($table);
        }
        DB::statement('DROP SEQUENCE IF EXISTS letter_ref_seq');
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
    }
};
