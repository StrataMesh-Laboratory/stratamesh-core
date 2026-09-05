#!/usr/bin/env bash
# Second Fog kernel on THIS machine (dialect/rehearsal only — NOT M-II distinct host).
set -euo pipefail

FOG_SRC="${FOG_SRC:-$(cd "$(dirname "$0")/../.." && pwd)}"
FOG_HOME="${FOG_HOME:-$HOME/StrataMesh/fog}"
PORT="${REHEARSAL_PORT:-8887}"
PRIMARY="${PRIMARY_FOG:-http://127.0.0.1:8787}"
NODE_ID="${REHEARSAL_NODE_ID:-FOG-NODE-REHEARSAL-001}"
DATA_DIR="${FOG_HOME}/data/rehearsal"
DB="$DATA_DIR/fog.db"
PIDFILE="$DATA_DIR/fog.pid"
LOG="$DATA_DIR/fog.log"
CMD="${1:-status}"

mkdir -p "$DATA_DIR"

banner() {
  echo "============================================================"
  echo " FOG PEER REHEARSAL — same host ≠ M-II distinct second host"
  echo " oracle_live must stay false until GCP/homelab peer is real"
  echo "============================================================"
}

start() {
  banner
  if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "already running pid=$(cat "$PIDFILE")"
    return 0
  fi
  if [[ ! -f "$FOG_SRC/src/node_persistent.py" ]]; then
    echo "missing $FOG_SRC/src/node_persistent.py" >&2
    exit 1
  fi
  cd "$FOG_SRC/src"
  nohup python3 node_persistent.py --port "$PORT" --db "$DB" --id "$NODE_ID" \
    >"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  sleep 2
  prove
}

stop() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
    echo "stopped"
  else
    echo "not running"
  fi
}

prove() {
  banner
  echo "-- primary $PRIMARY/health"
  curl -sS -m 3 "$PRIMARY/health" || echo "(primary unreachable)"
  echo
  echo "-- rehearsal http://127.0.0.1:$PORT/health"
  curl -sS -m 3 "http://127.0.0.1:$PORT/health" || echo "(rehearsal unreachable)"
  echo
  # Best-effort gossip/status probes
  for path in /status /gossip /inv; do
    code=$(curl -sS -m 2 -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT$path" || echo err)
    echo "rehearsal $path -> $code"
  done
  echo "OK: rehearsal process up. Promote to M-II only with deploy/gcp-free or deploy/homelab-peer."
}

status() {
  if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "running pid=$(cat "$PIDFILE")"
    prove
  else
    echo "stopped"
    banner
  fi
}

case "$CMD" in
  start) start ;;
  stop) stop ;;
  prove|status) status ;;
  restart) stop; start ;;
  *) echo "usage: $0 {start|stop|status|prove|restart}"; exit 2 ;;
esac
