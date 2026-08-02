<?php
/**
 * Capgo CapacitorUpdater self-hosted endpoint.
 * POST body includes version_name from the installed app bundle.
 * Responds with latest bundle metadata when an update is available.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$latestPath = __DIR__ . '/latest.json';
if (!is_file($latestPath)) {
  echo json_encode([
    'message' => 'No OTA bundle published yet',
    'error' => 'missing_latest',
    'version' => '',
  ]);
  exit;
}

$latest = json_decode((string) file_get_contents($latestPath), true);
if (!is_array($latest) || empty($latest['version']) || empty($latest['url']) || empty($latest['checksum'])) {
  echo json_encode([
    'message' => 'Invalid latest.json',
    'error' => 'invalid_latest',
    'version' => '',
  ]);
  exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '[]', true);
if (!is_array($body)) {
  $body = [];
}
$current = isset($body['version_name']) ? (string) $body['version_name'] : '';

if ($current !== '' && $current === (string) $latest['version']) {
  echo json_encode([
    'message' => 'Already up to date',
    'version' => '',
  ]);
  exit;
}

echo json_encode([
  'version' => (string) $latest['version'],
  'url' => (string) $latest['url'],
  'checksum' => (string) $latest['checksum'],
]);
