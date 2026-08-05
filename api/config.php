<?php
/**
 * Task Foundry cloud save API config.
 * Public Web OAuth client ID (same as the frontend - not a secret).
 */
return [
  'google_client_id' =>
    '769075164048-02j154eqdqlm58q5tch234bhb7hfl53b.apps.googleusercontent.com',
  // App session lifetime after a Google sign-in (seconds).
  'session_ttl' => 60 * 60 * 24 * 60, // 60 days
  // Max raw save JSON body (~2 MiB).
  'max_save_bytes' => 2 * 1024 * 1024,
];
