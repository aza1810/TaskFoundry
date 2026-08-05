<?php
/**
 * Tiny probe to confirm PHP runs under /apps/tf/api/.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
echo json_encode([
  'ok' => true,
  'php' => PHP_VERSION,
  'api' => 'task-foundry-cloud',
]);
