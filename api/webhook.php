<?php

$logFile = '/tmp/webhook.log';

function logMessage(string $message): void {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message" . PHP_EOL, FILE_APPEND);
}

$secret = getenv('WEBHOOK_SECRET') ?: 'change-me';
$providedToken = $_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? $_GET['secret'] ?? '';

if (!hash_equals($secret, $providedToken)) {
    http_response_code(401);
    echo "Unauthorized";
    exit;
}

$command = "/root/update.sh";
$output = shell_exec($command . " 2>&1");
