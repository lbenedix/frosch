<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

$room = require_room($_GET);
$playerId = clean_player_id($_GET['playerId'] ?? null);

$out = with_locked_state($room, function (array &$state) use ($playerId) {
    compute_match_times($state);
    if ($playerId !== '' && isset($state['players'][$playerId])) {
        $state['players'][$playerId]['lastSeen'] = time();
    }
});

send_json([
    'ok' => true,
    'state' => public_state($out['state']),
]);

