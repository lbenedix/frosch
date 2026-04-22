<?php

declare(strict_types=1);

function send_json(array $data, int $status = 200): void
{
	http_response_code($status);
	header('Content-Type: application/json; charset=utf-8');
	echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

function read_json_body(): array
{
	$raw = file_get_contents('php://input');
	if ($raw === false || trim($raw) === '') {
		return [];
	}
	$decoded = json_decode($raw, true);
	return is_array($decoded) ? $decoded : [];
}

function clean_room(?string $room): string
{
	$room = strtoupper((string) $room);
	$room = preg_replace('/[^A-Z0-9_-]/', '', $room) ?? '';
	return substr($room, 0, 12);
}

function clean_name(?string $name): string
{
	$name = trim((string) $name);
	if ($name === '') {
		return '';
	}
	return substr($name, 0, 18);
}

function clean_player_id(?string $id): string
{
	$id = (string) $id;
	$id = preg_replace('/[^a-zA-Z0-9_-]/', '', $id) ?? '';
	return substr($id, 0, 48);
}

function data_dir(): string
{
	$dir = __DIR__ . '/data';
	if (!is_dir($dir)) {
		mkdir($dir, 0775, true);
	}
	return $dir;
}

function room_file(string $room): string
{
	return data_dir() . '/room_' . $room . '.json';
}

function initial_state(string $room): array
{
	return [
		'room' => $room,
		'createdAt' => time(),
		'startedAt' => null,
		'endedAt' => null,
		'duration' => 30,
		'players' => [],
	];
}

function normalize_state(array $state): array
{
	$state['duration'] = isset($state['duration']) ? max(10, (int) $state['duration']) : 30;
	$state['players'] = isset($state['players']) && is_array($state['players']) ? $state['players'] : [];
	$state['startedAt'] = isset($state['startedAt']) ? (int) $state['startedAt'] : null;
	$state['endedAt'] = isset($state['endedAt']) ? (int) $state['endedAt'] : null;
	return $state;
}

function compute_match_times(array &$state): void
{
	if (!isset($state['startedAt']) || $state['startedAt'] === null) {
		return;
	}
	if (!isset($state['endedAt']) || $state['endedAt'] === null) {
		$end = (int) $state['startedAt'] + (int) $state['duration'];
		if (time() >= $end) {
			$state['endedAt'] = $end;
		}
	}
}

function with_locked_state(string $room, callable $callback): array
{
	$path = room_file($room);
	$fh = fopen($path, 'c+');
	if ($fh === false) {
		send_json(['ok' => false, 'error' => 'state_open_failed'], 500);
	}

	flock($fh, LOCK_EX);
	$raw = stream_get_contents($fh);
	$decoded = json_decode($raw ?: 'null', true);
	$state = is_array($decoded) ? normalize_state($decoded) : initial_state($room);

	$result = $callback($state);

	ftruncate($fh, 0);
	rewind($fh);
	fwrite($fh, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
	fflush($fh);
	flock($fh, LOCK_UN);
	fclose($fh);

	return [
		'state' => $state,
		'result' => $result,
	];
}

function public_state(array $state): array
{
	compute_match_times($state);
	$players = [];
	foreach ($state['players'] as $id => $p) {
		$players[] = [
			'id' => (string) $id,
			'name' => (string) ($p['name'] ?? 'Player'),
			'score' => (int) ($p['score'] ?? 0),
		];
	}

	$running = isset($state['startedAt']) && $state['startedAt'] !== null && (!isset($state['endedAt']) || $state['endedAt'] === null);
	$timeLeft = 0;
	if ($state['startedAt']) {
		$endAt = (int) $state['startedAt'] + (int) $state['duration'];
		$timeLeft = max(0, $endAt - time());
	}

	return [
		'room' => (string) $state['room'],
		'running' => $running,
		'timeLeft' => $timeLeft,
		'startedAt' => $state['startedAt'],
		'endedAt' => $state['endedAt'],
		'players' => $players,
	];
}

function require_room(array $input): string
{
	$room = clean_room($input['room'] ?? null);
	if ($room === '') {
		send_json(['ok' => false, 'error' => 'room_required'], 400);
	}
	return $room;
}

