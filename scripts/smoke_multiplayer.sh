#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${1:-8090}"
PHP_PID=""

cleanup() {
  if [[ -n "$PHP_PID" ]]; then
    kill "$PHP_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

php -S "127.0.0.1:${PORT}" -t "$ROOT" >/tmp/froschmazon-php.log 2>&1 &
PHP_PID=$!
sleep 1

join_resp=$(curl -sS -X POST "http://127.0.0.1:${PORT}/api/join.php" \
  -H 'Content-Type: application/json' \
  -d '{"room":"FROG1","name":"Alice","playerId":"p_alice"}')

echo "JOIN: $join_resp"
echo "$join_resp" | grep -q '"ok":true'

swat_resp=$(curl -sS -X POST "http://127.0.0.1:${PORT}/api/swat.php" \
  -H 'Content-Type: application/json' \
  -d '{"room":"FROG1","name":"Alice","playerId":"p_alice","points":25}')

echo "SWAT: $swat_resp"
echo "$swat_resp" | grep -q '"ok":true'

echo "$swat_resp" | grep -q '"score":25'

state_resp=$(curl -sS "http://127.0.0.1:${PORT}/api/state.php?room=FROG1&playerId=p_alice")
echo "STATE: $state_resp"
echo "$state_resp" | grep -q '"ok":true'

echo "Multiplayer smoke test passed."

