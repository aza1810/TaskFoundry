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

function tf_http_request(string $url, array $opts = []): array {
  $method = strtoupper((string) ($opts['method'] ?? 'GET'));
  $body = $opts['body'] ?? null;
  $headers = $opts['headers'] ?? [];
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    $curlHeaders = [];
    foreach ($headers as $k => $v) {
      $curlHeaders[] = $k . ': ' . $v;
    }
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT => 12,
      CURLOPT_FOLLOWLOCATION => true,
      CURLOPT_CUSTOMREQUEST => $method,
    ]);
    if ($curlHeaders) {
      curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
    }
    if ($body !== null) {
      curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $respBody = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($respBody === false) {
      return ['code' => 0, 'body' => null, 'error' => $err ?: 'curl failed'];
    }
    return ['code' => $code, 'body' => $respBody, 'error' => null];
  }

  $headerLines = '';
  foreach ($headers as $k => $v) {
    $headerLines .= $k . ': ' . $v . "\r\n";
  }
  $ctx = stream_context_create([
    'http' => [
      'method' => $method,
      'header' => $headerLines,
      'content' => $body ?? '',
      'timeout' => 12,
      'ignore_errors' => true,
    ],
  ]);
  $respBody = @file_get_contents($url, false, $ctx);
  $code = 0;
  if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
    $code = (int) $m[1];
  }
  if ($respBody === false) {
    return ['code' => $code, 'body' => null, 'error' => 'request failed'];
  }
  return ['code' => $code, 'body' => $respBody, 'error' => null];
}

function tf_http_get(string $url): ?string {
  $res = tf_http_request($url);
  if ($res['body'] === null || $res['code'] < 200 || $res['code'] >= 300) {
    return null;
  }
  return $res['body'];
}

function tf_b64url_decode(string $data): string {
  $remainder = strlen($data) % 4;
  if ($remainder) {
    $data .= str_repeat('=', 4 - $remainder);
  }
  return (string) base64_decode(strtr($data, '-_', '+/'));
}

/** @return array<string,mixed>|null */
function tf_google_certs(): ?array {
  static $cached = null;
  static $cachedAt = 0;
  if (is_array($cached) && time() - $cachedAt < 3600) {
    return $cached;
  }
  $body = tf_http_get('https://www.googleapis.com/oauth2/v3/certs');
  if ($body === null) {
    return $cached;
  }
  $json = json_decode($body, true);
  if (!is_array($json) || empty($json['keys']) || !is_array($json['keys'])) {
    return $cached;
  }
  $cached = $json;
  $cachedAt = time();
  return $cached;
}

/**
 * Verify a Google ID token.
 * Prefers local JWKS verification (works with long Android tokens), falls back to tokeninfo.
 *
 * @return array{ok:bool,payload?:array,error?:string}
 */
function tf_verify_google_id_token_detailed(string $idToken): array {
  $cfg = tf_config();
  $clientId = $cfg['google_client_id'];
  $parts = explode('.', $idToken);
  if (count($parts) !== 3) {
    return ['ok' => false, 'error' => 'Malformed Google ID token'];
  }

  $headerJson = tf_b64url_decode($parts[0]);
  $payloadJson = tf_b64url_decode($parts[1]);
  $header = json_decode($headerJson, true);
  $payload = json_decode($payloadJson, true);
  if (!is_array($header) || !is_array($payload) || empty($payload['sub'])) {
    return ['ok' => false, 'error' => 'Malformed Google ID token payload'];
  }

  $aud = $payload['aud'] ?? '';
  if (is_array($aud)) {
    $audOk = in_array($clientId, $aud, true);
  } else {
    $audOk = $aud === $clientId;
  }
  if (!$audOk) {
    return [
      'ok' => false,
      'error' =>
        'Google token audience mismatch. Native sign-in must use the Web client ID.',
    ];
  }

  $exp = (int) ($payload['exp'] ?? 0);
  if ($exp > 0 && $exp < time()) {
    return ['ok' => false, 'error' => 'Google ID token expired. Sign in again.'];
  }

  $iss = (string) ($payload['iss'] ?? '');
  if ($iss !== 'https://accounts.google.com' && $iss !== 'accounts.google.com') {
    return ['ok' => false, 'error' => 'Google ID token issuer invalid'];
  }

  // Local signature verify via Google JWKS (avoids tokeninfo URL-length issues).
  $kid = $header['kid'] ?? null;
  $alg = $header['alg'] ?? '';
  if ($alg === 'RS256' && is_string($kid) && $kid !== '' && function_exists('openssl_verify')) {
    $certs = tf_google_certs();
    if (is_array($certs)) {
      foreach ($certs['keys'] as $jwk) {
        if (!is_array($jwk) || ($jwk['kid'] ?? '') !== $kid) {
          continue;
        }
        $pem = tf_jwk_to_pem($jwk);
        if ($pem === null) {
          break;
        }
        $signed = $parts[0] . '.' . $parts[1];
        $sig = tf_b64url_decode($parts[2]);
        $ok = openssl_verify($signed, $sig, $pem, OPENSSL_ALGO_SHA256);
        if ($ok === 1) {
          return ['ok' => true, 'payload' => $payload];
        }
        return ['ok' => false, 'error' => 'Google ID token signature invalid'];
      }
    }
  }

  // Fallback: tokeninfo (may fail for very long Android tokens).
  $url =
    'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
  $res = tf_http_request($url);
  if ($res['body'] === null) {
    return [
      'ok' => false,
      'error' =>
        'Could not reach Google token verification (' .
        ($res['error'] ?: 'no response') .
        ')',
    ];
  }
  $info = json_decode($res['body'], true);
  if (!is_array($info) || empty($info['sub'])) {
    $err = is_array($info) ? (string) ($info['error_description'] ?? $info['error'] ?? '') : '';
    return [
      'ok' => false,
      'error' => $err !== '' ? 'Google tokeninfo: ' . $err : 'Invalid Google ID token',
    ];
  }
  $infoAud = $info['aud'] ?? '';
  if ($infoAud !== $clientId) {
    return ['ok' => false, 'error' => 'Google token audience mismatch'];
  }
  return ['ok' => true, 'payload' => $info];
}

/** @param array<string,mixed> $jwk */
function tf_jwk_to_pem(array $jwk): ?string {
  if (($jwk['kty'] ?? '') !== 'RSA' || empty($jwk['n']) || empty($jwk['e'])) {
    return null;
  }
  $n = tf_b64url_decode((string) $jwk['n']);
  $e = tf_b64url_decode((string) $jwk['e']);
  if ($n === '' || $e === '') {
    return null;
  }
  $modulus = tf_asn1_integer($n);
  $exponent = tf_asn1_integer($e);
  $rsaPublicKey = tf_asn1_sequence($modulus . $exponent);
  $bitString = "\x03" . tf_asn1_length(strlen($rsaPublicKey) + 1) . "\x00" . $rsaPublicKey;
  // rsaEncryption OID 1.2.840.113549.1.1.1
  $alg = tf_asn1_sequence(
    "\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01" . "\x05\x00",
  );
  $spki = tf_asn1_sequence($alg . $bitString);
  return "-----BEGIN PUBLIC KEY-----\n" .
    chunk_split(base64_encode($spki), 64, "\n") .
    "-----END PUBLIC KEY-----\n";
}

function tf_asn1_length(int $len): string {
  if ($len < 0x80) {
    return chr($len);
  }
  $out = '';
  while ($len > 0) {
    $out = chr($len & 0xff) . $out;
    $len >>= 8;
  }
  return chr(0x80 | strlen($out)) . $out;
}

function tf_asn1_integer(string $bytes): string {
  if ($bytes === '' || (ord($bytes[0]) & 0x80) !== 0) {
    $bytes = "\x00" . $bytes;
  }
  return "\x02" . tf_asn1_length(strlen($bytes)) . $bytes;
}

function tf_asn1_sequence(string $contents): string {
  return "\x30" . tf_asn1_length(strlen($contents)) . $contents;
}

/** Verify a Google ID token via JWKS/tokeninfo; return payload or null. */
function tf_verify_google_id_token(string $idToken): ?array {
  $result = tf_verify_google_id_token_detailed($idToken);
  if (!$result['ok'] || empty($result['payload']) || !is_array($result['payload'])) {
    return null;
  }
  return $result['payload'];
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
