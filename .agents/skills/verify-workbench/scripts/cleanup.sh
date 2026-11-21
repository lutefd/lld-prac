#!/usr/bin/env bash
# Stop only the instance launch.sh started; remove scratch workspaces. Evidence in test-results/verify/ is kept.
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
RUN="$ROOT/.practice/verify-run"
pid=$(cat "$RUN/pid" 2>/dev/null)
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
  kill -TERM "$pid"; for i in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  kill -0 "$pid" 2>/dev/null && kill -KILL "$pid"
fi
rm -rf "$RUN"
echo "cleaned"
