<?php

namespace App\Modules\Students\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Files\FileService;
use App\Modules\Students\Models\StudentProfile;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-S2/D30/D31: Head imports the registry CSV (preview first, then commit). Rows are matched by university email.
 * Required columns: email, full_name, student_number, programme, level. Optional: expected_grad_year.
 */
class RegistryController extends Controller
{
    private const REQUIRED = ['email', 'full_name', 'student_number', 'programme', 'level'];

    private const MAX_ROWS = 20000;

    public function __construct(private readonly FileService $files) {}

    public function preview(Request $request): JsonResponse
    {
        [$rows, $errors] = $this->parse($request);
        $existing = StudentProfile::whereIn('university_email', array_column($rows, 'email'))->pluck('university_email')->flip();

        return response()->json([
            'total' => count($rows) + count($errors), 'valid' => count($rows),
            'new' => count(array_filter($rows, fn ($r) => ! isset($existing[$r['email']]))),
            'updates' => count(array_filter($rows, fn ($r) => isset($existing[$r['email']]))),
            'errors' => array_slice($errors, 0, 50), 'error_count' => count($errors),
            'sample' => array_slice($rows, 0, 5),
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        [$rows, $errors] = $this->parse($request);
        $created = $updated = 0;
        DB::transaction(function () use ($rows, &$created, &$updated) {
            foreach ($rows as $r) {
                $profile = StudentProfile::where('university_email', $r['email'])->lockForUpdate()->first();
                $fields = ['full_name' => $r['full_name'], 'student_number' => $r['student_number'], 'programme' => $r['programme'],
                    'level' => $r['level'], 'on_registry' => true,
                    'expected_grad_year' => $r['expected_grad_year'] ?? StudentProfile::deriveGradYear($r['level'])];
                if ($profile) {
                    $profile->update($fields);
                    $updated++;
                } else {
                    StudentProfile::create($fields + ['university_email' => $r['email']]);
                    $created++;
                }
            }
        });
        $id = DB::table('registry_imports')->insertGetId([
            'imported_by' => $request->user()->id, 'rows_total' => count($rows) + count($errors), 'rows_created' => $created,
            'rows_updated' => $updated, 'rows_failed' => count($errors), 'errors' => json_encode(array_slice($errors, 0, 200)),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Audit::log('registry.imported', null, ['import_id' => $id, 'created' => $created, 'updated' => $updated, 'failed' => count($errors)]);

        return response()->json(['created' => $created, 'updated' => $updated, 'failed' => count($errors)]);
    }

    /** @return array{0: list<array>, 1: list<array{row:int,error:string}>} */
    private function parse(Request $request): array
    {
        $fileId = (int) $request->validate(['file_id' => ['required', 'integer']])['file_id'];
        $file = $this->files->ownReadyFile($request->user(), $fileId, 'registry_csv');
        $csv = $this->files->contents($file);
        $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv); // strip Excel BOM
        $lines = preg_split('/\r\n|\n|\r/', trim($csv));
        if (count($lines) < 2) {
            throw ValidationException::withMessages(['file_id' => 'The CSV has no data rows.']);
        }
        if (count($lines) - 1 > self::MAX_ROWS) {
            throw ValidationException::withMessages(['file_id' => 'At most '.self::MAX_ROWS.' rows per import.']);
        }
        $header = array_map(fn ($h) => strtolower(trim($h)), str_getcsv(array_shift($lines)));
        $missing = array_diff(self::REQUIRED, $header);
        if ($missing) {
            throw ValidationException::withMessages(['file_id' => 'Missing columns: '.implode(', ', $missing).'.']);
        }

        $domain = config('placement.student_email_domain');
        $rows = $errors = $seen = $seenNumbers = [];
        foreach ($lines as $i => $line) {
            if (trim($line) === '') {
                continue;
            }
            $cells = str_getcsv($line);
            $r = array_combine($header, array_pad(array_slice($cells, 0, count($header)), count($header), ''));
            $r = array_map(fn ($v) => trim((string) $v), $r);
            $rowNo = $i + 2;
            $email = strtolower($r['email']);
            $error = match (true) {
                ! filter_var($email, FILTER_VALIDATE_EMAIL) || ! str_ends_with($email, '@'.$domain) => "email must be a valid @{$domain} address",
                isset($seen[$email]) => 'duplicate email in file',
                $r['full_name'] === '' || mb_strlen($r['full_name']) > 120 => 'full_name is required (max 120)',
                $r['student_number'] === '' || mb_strlen($r['student_number']) > 40 => 'student_number is required (max 40)',
                isset($seenNumbers[$r['student_number']]) => 'duplicate student_number in file',
                $r['programme'] === '' || mb_strlen($r['programme']) > 120 => 'programme is required',
                ! in_array((int) $r['level'], [100, 200, 300, 400, 500, 600], true) => 'level must be 100–600',
                isset($r['expected_grad_year']) && $r['expected_grad_year'] !== '' && ((int) $r['expected_grad_year'] < 2000 || (int) $r['expected_grad_year'] > 2100) => 'expected_grad_year looks wrong',
                default => null,
            };
            // Defend spreadsheet users later opening exports: never store values starting with formula characters.
            foreach (['full_name', 'programme', 'student_number'] as $f) {
                if (! $error && preg_match('/^[=+\-@\t\r]/', $r[$f])) {
                    $error = "{$f} cannot start with = + - or @";
                }
            }
            $taken = ! $error && StudentProfile::where('student_number', $r['student_number'])->where('university_email', '!=', $email)->exists();
            if ($taken) {
                $error = 'student_number belongs to another student';
            }
            if ($error) {
                $errors[] = ['row' => $rowNo, 'error' => $error];

                continue;
            }
            $seen[$email] = true;
            $seenNumbers[$r['student_number']] = true;
            $rows[] = ['email' => $email, 'full_name' => $r['full_name'], 'student_number' => $r['student_number'], 'programme' => $r['programme'],
                'level' => (int) $r['level'], 'expected_grad_year' => ($r['expected_grad_year'] ?? '') !== '' ? (int) $r['expected_grad_year'] : null];
        }

        return [$rows, $errors];
    }
}
