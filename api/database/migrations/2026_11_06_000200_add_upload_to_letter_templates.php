<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Uploaded letter templates (FR-T1, upload flow): the body can now be sanitised HTML converted from an uploaded
 * Word/PDF file and edited in the browser. Existing plain-text versions keep format = 'text' and render as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('letter_templates', function (Blueprint $t) {
            $t->string('format', 10)->default('text')->after('body');
            $t->foreignId('source_file_id')->nullable()->after('format')->constrained('files');
        });
        DB::statement("ALTER TABLE letter_templates ADD CONSTRAINT letter_templates_format_check CHECK (format IN ('text','html'))");
        // The uploaded original (Word or PDF) is kept as a private file of a new kind.
        DB::statement('ALTER TABLE files DROP CONSTRAINT files_kind_check');
        DB::statement("ALTER TABLE files ADD CONSTRAINT files_kind_check CHECK (kind IN ('cv','letter_pdf','acceptance','report','evaluation','signature','registry_csv','template_source'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE files DROP CONSTRAINT files_kind_check');
        DB::statement("ALTER TABLE files ADD CONSTRAINT files_kind_check CHECK (kind IN ('cv','letter_pdf','acceptance','report','evaluation','signature','registry_csv'))");
        DB::statement('ALTER TABLE letter_templates DROP CONSTRAINT IF EXISTS letter_templates_format_check');
        Schema::table('letter_templates', function (Blueprint $t) {
            $t->dropConstrainedForeignId('source_file_id');
            $t->dropColumn('format');
        });
    }
};
