<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

$input = read_json_body();
$room = require_room($input);

$out = with_locked_state($room, function (array &$state) use ($room) {
    $state = initial_state($room);
});

send_json([
    'ok' => true,
    'state' => public_state($out['state']),
]);

