#!/usr/bin/env bash
# True continuous AIOps cycle — runs on always-on host (MacBook / Oracle / Fog box).
# Cloudflare Workers cannot hold an infinite loop; this process can.
set -euo pipefail

AIOPS_URL="${AIOPS_URL:-https://stratamesh-aiops.stratamesh.workers.dev/cycle}"
INTERVAL_SEC="${AIOPS_INTERVAL_SEC:-30}"
LOG="${AIOPS_LOG:-/tmp/aiops-continuous.log}"

echo "[aiops-continuous] url=$AIOPS_URL interval=${INTERVAL_SEC}s" | tee -a "$LOG"
echo "[aiops-continuous] started $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"

while true; do
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  if body=$(curl -sS -m 60 -H "Accept: application/json" "$AIOPS_URL" 2>/dev/null); then
    ok=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok')); print(d.get('summary',{}).get('critical',0)); print(d.get('summary',{}).get('warn',0))" 2>/dev/null || echo "parse_err")
    echo "[$ts] cycle ok/critical/warn: $ok" | tee -a "$LOG"
  else
    echo "[$ts] cycle FAILED (curl)" | tee -a "$LOG"
  fi
  sleep "$INTERVAL_SEC"
done
