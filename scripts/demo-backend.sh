#!/usr/bin/env bash
# Runs the Chatboat backend on this Mac and exposes it through an ngrok tunnel, so the
# frontend on Vercel can reach it. Safe to run again: it skips anything already running.
#
#   ./scripts/demo-backend.sh          start everything
#   ./scripts/demo-backend.sh stop     stop the API, tunnel and keep-awake
#
# Needs NGROK_DOMAIN in .env (your free static domain, e.g. something.ngrok-free.app)
# and ngrok signed in once with:  ngrok config add-authtoken <token>
set -euo pipefail
cd "$(dirname "$0")/.."
LOGS=.demo
mkdir -p "$LOGS"

domain=$(grep -E '^NGROK_DOMAIN=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)

stop() {
  pkill -f "ngrok http" 2>/dev/null && echo "Stopped tunnel" || true
  pkill -f "apps/api.*src/server.ts|tsx.*src/server.ts" 2>/dev/null && echo "Stopped API" || true
  pkill -f "caffeinate -dims" 2>/dev/null && echo "Stopped keep-awake" || true
}
if [[ "${1:-}" == "stop" ]]; then stop; exit 0; fi

up() { curl -s -o /dev/null -m 3 "$1"; }

# 1. Docker and the databases
if ! docker info >/dev/null 2>&1; then
  echo "Starting Docker…"; open -a Docker
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 3; done
fi
docker compose up -d postgres mailpit >/dev/null
docker start chatboat-mongo-test >/dev/null 2>&1 || true
for _ in $(seq 1 30); do docker compose exec -T postgres pg_isready -U chatboat >/dev/null 2>&1 && break; sleep 2; done
echo "✓ Postgres and Mailpit running"
pnpm --filter @chatboat/db migrate >/dev/null && echo "✓ Database up to date"

# 2. API on port 4000
if up http://localhost:4000/health; then
  echo "✓ API already running"
else
  nohup pnpm --filter @chatboat/api start >"$LOGS/api.log" 2>&1 &
  for _ in $(seq 1 30); do up http://localhost:4000/health && break; sleep 1; done
  up http://localhost:4000/health && echo "✓ API started (logs: $LOGS/api.log)" || { echo "✗ API did not start, see $LOGS/api.log"; exit 1; }
fi

# 3. Tunnel
if [[ -z "$domain" ]]; then
  echo "✗ NGROK_DOMAIN is not set in .env"; exit 1
fi
if pgrep -f "ngrok http" >/dev/null; then
  echo "✓ Tunnel already running"
else
  nohup ngrok http --url="$domain" 4000 --log=stdout >"$LOGS/ngrok.log" 2>&1 &
  sleep 4
fi
if curl -s -m 10 -H 'ngrok-skip-browser-warning: 1' "https://$domain/health" | grep -q '"ok":true'; then
  echo "✓ Tunnel works: https://$domain"
else
  echo "✗ Tunnel not reachable yet, see $LOGS/ngrok.log"; exit 1
fi

# 4. Keep the Mac awake while the demo runs (display may still sleep)
pgrep -f "caffeinate -dims" >/dev/null || (nohup caffeinate -dims >/dev/null 2>&1 &)
echo "✓ Mac will stay awake. Stop everything with: ./scripts/demo-backend.sh stop"
