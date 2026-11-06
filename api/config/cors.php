<?php

/*
 * SEC-03: the API is called only server-to-server by the Next.js BFF (AD8), never from browsers,
 * so it grants no cross-origin access at all.
 */
return [
    'paths' => [],
    'allowed_methods' => [],
    'allowed_origins' => [],
    'allowed_origins_patterns' => [],
    'allowed_headers' => [],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
