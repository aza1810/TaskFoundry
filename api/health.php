<?php
/**
 * Tiny probe to confirm PHP runs under /apps/tf/api/.
 */
require __DIR__ . '/bootstrap.php';

tf_cors();

$certs = tf_google_certs();
$googleCerts = is_array($certs) && !empty($certs['keys']);

tf_json_out([
  'ok' => true,
  'php' => PHP_VERSION,
  'api' => 'task-foundry-cloud',
  'googleCerts' => $googleCerts,
  'openssl' => function_exists('openssl_verify'),
]);
