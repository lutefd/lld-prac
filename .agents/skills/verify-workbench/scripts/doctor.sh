#!/usr/bin/env bash
# Read-only: is the instance we started up and worth driving?
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
RUN="$ROOT/.practice/verify-run"
[ -f "$RUN/env" ] && . "$RUN/env"
WEB=${PRACTICE_WEB_PORT:-5173}; API=${PRACTICE_API_PORT:-3001}
fail=0
pid=$(cat "$RUN/pid" 2>/dev/null)
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then echo "ok   dev process $pid is ours and alive"; else echo "FAIL no live dev process from this skill (run launch.sh)"; fail=1; fi
h=$(curl -fsS http://127.0.0.1:$API/api/health 2>&1) && echo "ok   api health: $h" || { echo "FAIL api health"; fail=1; }
n=$(curl -fsS http://127.0.0.1:$API/api/problems 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log((j.problems||j).length)}catch{console.log(0)}})')
[ "$n" = 44 ] && echo "ok   catalog has 44 exercises" || { echo "FAIL catalog count=$n (expected 44)"; fail=1; }
curl -fsS http://127.0.0.1:$WEB/ | grep -q '<div id="root"' && echo "ok   UI serves index" || { echo "FAIL UI"; fail=1; }
for t in go python3 node; do command -v $t >/dev/null && echo "ok   $t present" || echo "warn $t missing (that language's runs will fail)"; done
exit $fail
