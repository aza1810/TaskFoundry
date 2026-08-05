<?php
/**
 * POST { "idToken": "<Google JWT>" }
 * → { token, expiresAt, sub }
 *
 * Exchanges a Google ID token for a Task Foundry cloud session.
 */
require __DIR__ . '/bootstrap.php';

tf_cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  tf_json_out(['error' => 'Method not allowed'], 405);
}

$body = tf_read_json_body();
$idToken = trim((string) ($body['idToken'] ?? ''));
if ($idToken === '') {
  tf_json_out(['error' => 'idToken required'], 400);
}

$payload = tf_verify_google_id_token($idToken);
if ($payload === null) {
  tf_json_out(['error' => 'Invalid Google ID token'], 401);
}

$session = tf_create_session(
  (string) $payload['sub'],
  isset($payload['email']) ? (string) $payload['email'] : null,
);

tf_json_out($session);
