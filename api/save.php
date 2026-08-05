<?php
/**
 * Cloud foundry save for the authenticated Google account.
 *
 * GET  Authorization: Bearer <tf_...>
 *   → { savedAt, state } or 404
 *
 * PUT  Authorization: Bearer <tf_...>
 *   body: { savedAt: number(ms), state: object }
 *   → { ok: true, savedAt }
 */
require __DIR__ . '/bootstrap.php';

tf_cors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$session = tf_require_session();
$sub = (string) $session['sub'];
$path = tf_save_path($sub);

if ($method === 'GET') {
  if (!is_file($path)) {
    tf_json_out(['error' => 'No cloud save'], 404);
  }
  $raw = file_get_contents($path);
  if ($raw === false) {
    tf_json_out(['error' => 'Could not read save'], 500);
  }
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data['state']) || !is_array($data['state'])) {
    tf_json_out(['error' => 'Corrupt cloud save'], 500);
  }
  tf_json_out([
    'savedAt' => (int) ($data['savedAt'] ?? 0),
    'state' => $data['state'],
    'updatedAt' => (int) ($data['updatedAt'] ?? 0),
  ]);
}

if ($method === 'PUT') {
  $body = tf_read_json_body();
  $savedAt = (int) ($body['savedAt'] ?? 0);
  $state = $body['state'] ?? null;
  if ($savedAt <= 0 || !is_array($state)) {
    tf_json_out(['error' => 'savedAt and state required'], 400);
  }
  if (!isset($state['version']) || !is_numeric($state['version'])) {
    tf_json_out(['error' => 'state.version required'], 400);
  }

  // Last-write-wins by client savedAt (ignore older uploads).
  if (is_file($path)) {
    $existingRaw = file_get_contents($path);
    $existing = $existingRaw ? json_decode($existingRaw, true) : null;
    if (is_array($existing) && (int) ($existing['savedAt'] ?? 0) > $savedAt) {
      tf_json_out([
        'ok' => true,
        'savedAt' => (int) $existing['savedAt'],
        'skipped' => true,
      ]);
    }
  }

  $record = [
    'sub' => $sub,
    'savedAt' => $savedAt,
    'updatedAt' => time() * 1000,
    'state' => $state,
  ];
  $json = json_encode($record, JSON_UNESCAPED_SLASHES);
  if ($json === false) {
    tf_json_out(['error' => 'Could not encode save'], 500);
  }
  $cfg = tf_config();
  if (strlen($json) > (int) $cfg['max_save_bytes']) {
    tf_json_out(['error' => 'Save too large'], 413);
  }
  if (file_put_contents($path, $json, LOCK_EX) === false) {
    tf_json_out(['error' => 'Could not write save'], 500);
  }
  tf_json_out(['ok' => true, 'savedAt' => $savedAt]);
}

tf_json_out(['error' => 'Method not allowed'], 405);
