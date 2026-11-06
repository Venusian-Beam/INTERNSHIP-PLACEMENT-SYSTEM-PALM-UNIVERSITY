<?php

namespace App\Modules\Reports;

use Symfony\Component\HttpFoundation\StreamedResponse;

/** CSV export (FR-R5) with spreadsheet formula-injection neutralised: user-supplied text can't run as a formula. */
class Csv
{
    public static function download(string $name, array $header, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows names correctly
            fputcsv($out, $header, escape: '');
            foreach ($rows as $row) {
                fputcsv($out, array_map([self::class, 'safe'], $row), escape: '');
            }
            fclose($out);
        }, $name.'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public static function safe(mixed $v): string
    {
        $s = (string) $v;

        return preg_match('/^[=+\-@\t\r]/', $s) ? "'".$s : $s;
    }
}
