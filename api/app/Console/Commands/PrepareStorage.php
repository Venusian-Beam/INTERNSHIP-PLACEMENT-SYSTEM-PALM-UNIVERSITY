<?php

namespace App\Console\Commands;

use Aws\S3\S3Client;
use Illuminate\Console\Command;
use Throwable;

/** Creates the private bucket and the CORS rule that lets browsers PUT/GET through presigned URLs (AD6). */
class PrepareStorage extends Command
{
    protected $signature = 'storage:prepare';

    protected $description = 'Ensure the object-storage bucket exists with private access and browser CORS for the web app';

    public function handle(): int
    {
        $c = config('filesystems.disks.s3');
        $s3 = new S3Client([
            'version' => 'latest', 'region' => $c['region'], 'endpoint' => $c['endpoint'],
            'use_path_style_endpoint' => (bool) $c['use_path_style_endpoint'],
            'credentials' => ['key' => $c['key'], 'secret' => $c['secret']],
        ]);
        $bucket = $c['bucket'];

        if (! $s3->doesBucketExist($bucket)) {
            $s3->createBucket(['Bucket' => $bucket]);
            $this->info("Created bucket {$bucket}.");
        } else {
            $this->line("Bucket {$bucket} exists.");
        }

        try {
            $s3->putBucketCors(['Bucket' => $bucket, 'CORSConfiguration' => ['CORSRules' => [[
                'AllowedOrigins' => [config('placement.frontend_url')],
                'AllowedMethods' => ['POST', 'GET'],
                'AllowedHeaders' => ['content-type'],
                'MaxAgeSeconds' => 3600,
            ]]]]);
            $this->info('CORS rule set for '.config('placement.frontend_url').'.');
        } catch (Throwable $e) {
            $this->warn('Could not set CORS: '.$e->getMessage());
        }

        return self::SUCCESS;
    }
}
