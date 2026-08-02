<?php
/**
 * CORS-enabled latest.json for the Android WebView (origin https://localhost).
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$path = __DIR__ . '/latest.json';
if (!is_file($path)) {
  http_response_code(404);
  header('Content-Type: application/json');
  echo json_encode(['error' => 'latest.json missing']);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
readfile($path);
