<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

$input = read_json_body();
$room = require_room($input);
$playerId = clean_player_id($input['playerId'] ?? null);
$name = clean_name($input['name'] ?? null);
$points = (int) ($input['points'] ?? 0);
$points = max(-50, min(500, $points));

if ($playerId === '') {
    send_json(['ok' => false, 'error' => 'player_id_required'], 400);
}
if ($name === '') {
    $name = 'Player-' . substr($playerId, -4);
}

$out = with_locked_state($room, function (array &$state) use ($playerId, $name, $points) {
    compute_match_times($state);

    if (!isset($state['players'][$playerId])) {
        $state['players'][$playerId] = ['name' => $name, 'score' => 0, 'lastSeen' => time()];
    }

    if (!isset($state['startedAt']) || $state['startedAt'] === null) {
        $state['startedAt'] = time();
    }

    compute_match_times($state);
    $ended = isset($state['endedAt']) && $state['endedAt'] !== null;
    if (!$ended) {
        $state['players'][$playerId]['score'] = (int) ($state['players'][$playerId]['score'] ?? 0) + $points;
    }

    $state['players'][$playerId]['name'] = $name;
    $state['players'][$playerId]['lastSeen'] = time();
});

send_json([
    'ok' => true,
    'state' => public_state($out['state']),
]);

