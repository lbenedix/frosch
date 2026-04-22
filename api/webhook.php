<?php

$secret = getenv('WEBHOOK_SECRET') ?: 'change-me';
$providedToken = $_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? $_GET['secret'] ?? '';

if (!hash_equals($secret, $providedToken)) {
    http_response_code(401);
    echo "Unauthorized";
    exit;
}

$command = "/root/update.sh";
$output = shell_exec($command . " 2>&1");
