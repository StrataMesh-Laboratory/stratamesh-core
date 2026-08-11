#!/usr/bin/env bash
# B0 emission audit — lab reproducible checks (no secrets required for public endpoints)
set -euo pipefail
POC="${POC_URL:-https://stratamesh-poc.stratamesh.workers.dev}"
TOKEN="${TOKEN_URL:-https://stratamesh-token.stratamesh.workers.dev}"
AGORA="${AGORA_URL:-https://stratamesh-agora.stratamesh.workers.dev}"
NODE="${NODE_ID:-FOG-NODE-PT-CM-001}"

echo "== B0 Emission Audit =="
echo "node=$NODE"
echo "--- health ---"
curl -sS "$POC/health" | head -c 400; echo
echo "--- global avg ---"
curl -sS "$POC/global-avg" | head -c 600; echo
echo "--- agora rate EUR ---"
curl -sS "$AGORA/agora/rate?quote=EUR" | head -c 400; echo
echo "--- onchain measure ---"
curl -sS "$POC/onchain?node_id=$NODE" | head -c 800; echo
echo "--- balance ---"
curl -sS "$TOKEN/balance?account=$NODE" | head -c 400; echo
echo "--- incremental re-claim (expect 0 if no new contribution) ---"
curl -sS -X POST "$POC/mint" -H 'Content-Type: application/json' \
  -d "{\"node_id\":\"$NODE\",\"from_onchain\":true,\"audit_quality\":true,\"contribution_type\":\"ipfs_pin\",\"proof_hash\":\"b0-audit\"}" | head -c 600; echo
echo "OK — review outputs: sole mint path is PoC; labour/DAO must not appear as mint."
