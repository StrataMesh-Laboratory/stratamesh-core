#!/usr/bin/env bash
# Periodically push local node /status to public Worker
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${NODE_STATUS_URL:-http://127.0.0.1:8787/status}"
INTERVAL="${INTERVAL:-60}"
export STATUS_TOKEN="${STATUS_TOKEN:-strata-status-ingest-fe2b24ed992ccd30}"
export STATUS_INGEST_URL="${STATUS_INGEST_URL:-https://stratamesh-status.stratamesh.workers.dev/ingest}"
echo "Publishing $URL every ${INTERVAL}s → $STATUS_INGEST_URL"
while true; do
  python3 "$ROOT/src/publish_status.py" --url "$URL" || echo "publish failed (node down?)"
  sleep "$INTERVAL"
done
