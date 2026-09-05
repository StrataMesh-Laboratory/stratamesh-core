#!/bin/bash
# Run one desk specialty from outbox / bus — call from TUI r path or manually.
# Usage: bash deploy/mac-fog/desk-agent-run.sh [opencode|hermes|openclaw|all]
set -euo pipefail
REPO="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
AGENT="${1:-all}"
cd "$REPO"
mkdir -p "$FOG/data/desk-outbox" "$FOG/data/desk-meters"

run_ops() {
  python3 ops/desk-collegium/desk_ops.py cycle --max 1 || true
}

run_actions() {
  python3 ops/desk-collegium/desk_actions.py sync --limit 12 || true
}

run_opencode() {
  BRIEF="$FOG/data/desk-outbox/opencode-next.md"
  if [[ -f "$BRIEF" ]]; then
    echo "OpenCode brief ready: $BRIEF"
    # Ensure a code task is in flight via ops cycle preference
    python3 ops/desk-collegium/desk_ops.py cycle --max 1 || true
    # Record that OpenCode was nudged (phi3 session is human/local)
    python3 - << PY
import json, time
from pathlib import Path
p = Path("$FOG/data/desk-meters/opencode.json")
p.write_text(json.dumps({
  "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
  "brief": "opencode-next.md",
  "model": "phi3:latest",
  "status": "briefed",
}, indent=2) + "\n")
print(p)
PY
  else
    echo "no opencode-next.md — ops cycle will create when code work exists"
    run_ops
  fi
}

run_hermes() {
  BRIEF="$FOG/data/desk-outbox/hermes-next.md"
  python3 ops/desk-collegium/desk_protocol.py check || true
  python3 ops/desk-collegium/desk_ops.py board || true
  run_ops
  if [[ -f "$BRIEF" ]]; then
    echo "Hermes brief: $BRIEF (academy_teach duty)"
  fi
}

run_openclaw() {
  if [[ -x "$REPO/deploy/mac-fog/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/desk-claw-probe.sh" || true
  fi
  run_ops
}

case "$AGENT" in
  opencode) run_actions; run_opencode ;;
  hermes) run_actions; run_hermes ;;
  openclaw) run_actions; run_openclaw ;;
  all)
    run_actions
    run_hermes
    run_openclaw
    run_opencode
    ;;
  *)
    echo "usage: $0 [opencode|hermes|openclaw|all]"
    exit 2
    ;;
esac
echo "desk-agent-run done agent=$AGENT"
