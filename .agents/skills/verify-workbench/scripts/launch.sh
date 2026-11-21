#!/usr/bin/env bash
# Start an isolated Workbench dev instance on free ports. Usage: launch.sh  (run from anywhere)
# Writes .practice/verify-run/env (PRACTICE_WEB_PORT, PRACTICE_API_PORT); other scripts and `source` of it use those.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
RUN="$ROOT/.practice/verify-run"
if [ -f "$RUN/pid" ] && kill -0 "$(cat "$RUN/pid")" 2>/dev/null; then
  echo "REFUSING: an instance from this checkout is already running (pid $(cat "$RUN/pid")). Run cleanup.sh first." >&2; exit 2
fi
free_port() { node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
WEB=$(free_port); API=$(free_port)
rm -rf "$RUN"; mkdir -p "$RUN/workspaces"
printf 'export PRACTICE_WEB_PORT=%s\nexport PRACTICE_API_PORT=%s\n' "$WEB" "$API" >"$RUN/env"
cd "$ROOT"
PRACTICE_WEB_PORT=$WEB PRACTICE_API_PORT=$API PRACTICE_WORKSPACE_ROOT="$RUN/workspaces" PRACTICE_MAX_WORKSPACES=100 \
  nohup node scripts/dev.ts >"$RUN/dev.log" 2>&1 &
echo $! >"$RUN/pid"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:$API/api/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:$WEB/ >/dev/null 2>&1; then
    echo "READY pid=$(cat "$RUN/pid") ui=http://127.0.0.1:$WEB api=http://127.0.0.1:$API log=$RUN/dev.log"; exit 0
  fi
  sleep 1
done
echo "NOT READY after 60s; see $RUN/dev.log" >&2
bash "$(dirname "$0")/cleanup.sh"; exit 1
