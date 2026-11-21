#!/usr/bin/env bash
# Start an isolated Workbench dev instance. Usage: launch.sh  (run from anywhere)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
RUN="$ROOT/.practice/verify-run"
for p in 5173 3001; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
    echo "REFUSING: port $p already in use (not started by this skill). Ports are hardcoded; cannot run side by side." >&2; exit 2
  fi
done
rm -rf "$RUN"; mkdir -p "$RUN/workspaces"
cd "$ROOT"
PRACTICE_WORKSPACE_ROOT="$RUN/workspaces" PRACTICE_MAX_WORKSPACES=100 \
  nohup node scripts/dev.ts >"$RUN/dev.log" 2>&1 &
echo $! >"$RUN/pid"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then
    echo "READY pid=$(cat "$RUN/pid") ui=http://127.0.0.1:5173 log=$RUN/dev.log"; exit 0
  fi
  sleep 1
done
echo "NOT READY after 60s; see $RUN/dev.log" >&2
bash "$(dirname "$0")/cleanup.sh"; exit 1
