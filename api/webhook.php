<?php

$logFile = '/tmp/webhook.log';

function logMessage(string $message): void {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message" . PHP_EOL, FILE_APPEND);
}

logMessage("Webhook triggered. Method: " . $_SERVER['REQUEST_METHOD'] . ", IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));

echo "Hello World!";
logMessage("Response sent.");

$command = "/root/update.sh";
logMessage("Executing command: $command");
$output = shell_exec($command . " 2>&1");
logMessage("Command output: " . ($output !== null ? trim($output) : '(null - command may have failed or produced no output)'));
