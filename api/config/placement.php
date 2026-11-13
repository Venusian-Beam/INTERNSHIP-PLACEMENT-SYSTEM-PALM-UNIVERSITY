<?php

/*
 * Application settings for the internship placement system (docs 04 and 10).
 * Values marked "proposed" are engineering defaults awaiting confirmation at review.
 */
return [
    // Letterhead name (OQ2: replace with the official name/logo).
    'university_name' => env('UNIVERSITY_NAME', 'University Career Services'),

    // Where emailed links (verification, reset, invites) send people.
    'frontend_url' => rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/'),

    // FR-A1: only this email domain may self-register as a student.
    'student_email_domain' => strtolower(env('STUDENT_EMAIL_DOMAIN', 'st.university.example')),

    // NFR-S3 (proposed): one-time login code for staff, Head, President.
    'otp' => ['digits' => 6, 'ttl_minutes' => 10, 'max_attempts' => 5],

    // TEMPORARY testing aid: return the sign-in code in the login response so the sign-in page logs it to the
    // browser console (used on the live site until email is configured). Anyone with a password can then skip
    // the emailed code, so turn this off (unset EXPOSE_LOGIN_CODES) before real users sign in.
    'expose_login_codes' => (bool) env('EXPOSE_LOGIN_CODES', false),

    // NFR-S5 (proposed).
    'password_min' => 10,

    'invitation_ttl_days' => 7,

    // NFR-S9 (proposed): per-file upload limits.
    'uploads' => [
        'max_bytes' => 4 * 1024 * 1024,
        'presign_minutes' => 5,
        'kinds' => [
            'cv' => ['application/pdf'],
            'acceptance' => ['application/pdf'],
            'report' => ['application/pdf'],
            'evaluation' => ['application/pdf'],
            'signature' => ['image/png'],
            'registry_csv' => ['text/csv'],
            'template_source' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'],
        ],
    ],

    // BR5 / OQ4 / OQ7.
    'letters' => [
        'ref_prefix' => env('LETTER_REF_PREFIX', 'CS/INT'),
        'max_attachment_bytes' => 20 * 1024 * 1024,
    ],

    // NFR-R4: Gmail's documented limit is 500 emails per day.
    'mail_daily_limit' => (int) env('MAIL_DAILY_LIMIT', 500),

    // Shared secret between the Next.js server and this API (TrustBff middleware). Empty = check disabled.
    'bff_key' => env('BFF_SHARED_KEY', ''),

    // Secret header Vercel Cron sends to /api/internal/cron/* (Release 2 jobs).
    'cron_secret' => env('CRON_SECRET'),
];
