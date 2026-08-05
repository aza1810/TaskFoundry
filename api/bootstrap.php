<?php
/**
 * Shared helpers for Task Foundry cloud API.
 */

function tf_config(): array {
  static $cfg = null;
  if ($cfg === null) {
    $cfg = require __DIR__ . '/config.php';
  }
  return $cfg;
}

function tf_data_dir(): string {
  $dir = __DIR__ . '/data';
  if (!is_dir($dir)) {
    @mkdir($dir, 0750, true);
  }
  foreach (['sessions', 'saves'] as $sub) {
    $path = $dir . '/' . $sub;
    if (!is_dir($path)) {
      @mkdir($path, 0750, true);
    }
  }
  return $dir;
}

function tf_cors(): void {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: GET, PUT, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');
  header('Access-Control-Max-Age: 86400');
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
}

function tf_json_out($data, int $code = 200): void {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store, max-age=0');
  echo json_encode($data, JSON_UNESCAPED_SLASHES);
  exit;
}

function tf_read_json_body(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    return [];
  }
  $cfg = tf_config();
  if (strlen($raw) > (int) $cfg['max_save_bytes']) {
    tf_json_out(['error' => 'Payload too large'], 413);
  }
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    tf_json_out(['error' => 'Invalid JSON'], 400);
  }
  return $data;
}

function tf_http_get(string $url): ?string {
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT => 12,
      CURLOPT_FOLLOWLOCATION => true,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
      return null;
    }
    return $body;
  }
  $ctx = stream_context_create([
    'http' => [
      'timeout' => 12,
      'ignore_errors' => true,
    ],
  ]);
  $body = @file_get_contents($url, false, $ctx);
  return $body === false ? null : $body;
}

/** Verify a Google ID token via tokeninfo; return payload or null. */
function tf_verify_google_id_token(string $idToken): ?array {
  $cfg = tf_config();
  $clientId = $cfg['google_client_id'];
  $url =
    'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
  $body = tf_http_get($url);
  if ($body === null) {
    return null;
  }
  $payload = json_decode($body, true);
  if (!is_array($payload) || empty($payload['sub'])) {
    return null;
  }
  $aud = $payload['aud'] ?? '';
  if ($aud !== $clientId) {
    return null;
  }
  $exp = (int) ($payload['exp'] ?? 0);
  if ($exp > 0 && $exp < time()) {
    return null;
  }
  return $payload;
}

function tf_bearer_token(): ?string {
  $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
    return $m[1];
  }
  return null;
}

function tf_session_path(string $token): string {
  return tf_data_dir() . '/sessions/' . hash('sha256', $token) . '.json';
}

function tf_save_path(string $sub): string {
  // Google sub is digits; keep filename safe.
  $safe = preg_replace('/[^a-zA-Z0-9_-]/', '', $sub);
  if ($safe === '' || $safe !== $sub) {
    $safe = 'h_' . hash('sha256', $sub);
  }
  return tf_data_dir() . '/saves/' . $safe . '.json';
}

function tf_create_session(string $sub, ?string $email): array {
  $cfg = tf_config();
  $ttl = (int) $cfg['session_ttl'];
  $token = 'tf_' . bin2hex(random_bytes(32));
  $expiresAt = time() + $ttl;
  $record = [
    'sub' => $sub,
    'email' => $email,
    'expiresAt' => $expiresAt,
    'createdAt' => time(),
  ];
  $path = tf_session_path($token);
  if (file_put_contents($path, json_encode($record), LOCK_EX) === false) {
    tf_json_out(['error' => 'Could not create session'], 500);
  }
  return [
    'token' => $token,
    'expiresAt' => $expiresAt * 1000,
    'sub' => $sub,
  ];
}

/** @return array{sub:string,email?:string,expiresAt:int}|null */
function tf_load_session(string $token): ?array {
  if ($token === '' || strpos($token, 'tf_') !== 0) {
    return null;
  }
  $path = tf_session_path($token);
  if (!is_file($path)) {
    return null;
  }
  $raw = file_get_contents($path);
  if ($raw === false) {
    return null;
  }
  $record = json_decode($raw, true);
  if (!is_array($record) || empty($record['sub'])) {
    return null;
  }
  if ((int) ($record['expiresAt'] ?? 0) < time()) {
    @unlink($path);
    return null;
  }
  return $record;
}

function tf_require_session(): array {
  $token = tf_bearer_token();
  if ($token === null) {
    tf_json_out(['error' => 'Missing Authorization bearer token'], 401);
  }
  $session = tf_load_session($token);
  if ($session === null) {
    tf_json_out(['error' => 'Invalid or expired session'], 401);
  }
  return $session;
}
