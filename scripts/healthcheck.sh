#!/usr/bin/env bash
# A0 health: local node + optional public status
set -euo pipefail
BASE="${NODE_BASE:-http://127.0.0.1:8787}"
echo "== local $BASE =="
curl -sf "$BASE/health" | head -c 200; echo
curl -sf "$BASE/status" | python3 -c "import sys,json;d=json.load(sys.stdin);print('phase',d.get('phase'),'txs',d.get('dag',{}).get('transaction_count'),'spa',d.get('spa',{}).get('active'),'uptime',d.get('uptime_seconds'))"
if [[ "${CHECK_PUBLIC:-1}" == "1" ]]; then
  echo "== public status =="
  curl -sf "https://stratamesh-status.stratamesh.workers.dev/status" | python3 -c "import sys,json;d=json.load(sys.stdin);print('phase',d.get('phase'),'txs',d.get('dag',{}).get('transaction_count'),'source',d.get('source','?')[:60])"
fi
echo "healthcheck OK"
