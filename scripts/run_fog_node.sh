#!/usr/bin/env bash
# Start Calhegas Morais Fog node (lab)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/src"
export IPFS_API_URL="${IPFS_API_URL:-}"
PORT="${PORT:-8787}"
DB="${DB:-/tmp/stratamesh-fog.db}"
ID="${NODE_ID:-FOG-NODE-PT-CM-001}"
echo "Starting Fog node $ID on :$PORT  db=$DB"
exec python3 node_persistent.py --port "$PORT" --db "$DB" --id "$ID"
