#!/bin/bash
# Run one desk specialty from outbox / bus — call from TUI r path or manually.
# Usage: bash deploy/mac-fog/desk-agent-run.sh [opencode|hermes|openclaw|all]
# Ensures cycle-owned surfaces (TODO/CONTEXT/reports/journals) before specialty work.
set -euo pipefail
REPO="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
AGENT="${1:-all}"
cd "$REPO"
mkdir -p "$FOG/data/desk-outbox" "$FOG/data/desk-meters" "$FOG/data/desk-outbox/reports" "$FOG/data/desk-outbox/journals"

ensure_surfaces() {
  python3 ops/desk-collegium/desk_reports.py ensure-surfaces || true
}

run_ops() {
  python3 ops/desk-collegium/desk_ops.py cycle --max 1 || true
}

run_actions() {
  python3 ops/desk-collegium/desk_actions.py sync --limit 12 || true
}

run_opencode() {
  BRIEF="$FOG/data/desk-outbox/opencode-next.md"
  echo "OpenCode: read CONTEXT + TODO.md + reports/ then specialty=code"
  if [[ -f "$BRIEF" ]]; then
    echo "OpenCode brief ready: $BRIEF"
  fi
  python3 ops/desk-collegium/desk_ops.py cycle --max 1 || true
  python3 - << PY
import json, time
from pathlib import Path
p = Path("$FOG/data/desk-meters/opencode.json")
p.write_text(json.dumps({
  "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
  "brief": "opencode-next.md",
  "model": "phi3:latest",
  "status": "briefed",
  "wake": "CONTEXT→protocol→TODO→reports→code",
}, indent=2) + "\n")
print(p)
PY
}

run_hermes() {
  BRIEF="$FOG/data/desk-outbox/hermes-next.md"
  python3 ops/desk-collegium/desk_protocol.py check || true
  python3 ops/desk-collegium/desk_ops.py board || true
  run_ops
  echo "Hermes: native Mac desk — Bot=escalate only; self-queue coord from TODO.md"
  if [[ -f "$BRIEF" ]]; then
    echo "Hermes brief: $BRIEF (academy_teach + TODO board)"
  fi
  ls -la "$FOG/data/desk-outbox/TODO.md" "$FOG/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md" 2>/dev/null || true
}

run_openclaw() {
  echo "OpenClaw: self-audit hops; read TODO.md specialty=claw"
  if [[ -x "$REPO/deploy/mac-fog/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/desk-claw-probe.sh" || true
  elif [[ -x "$REPO/deploy/mac-fog/openclaw/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/openclaw/desk-claw-probe.sh" || true
  fi
  run_ops
}

# Always refresh surfaces first (Bot never required)
ensure_surfaces
run_actions

case "$AGENT" in
  opencode) run_opencode ;;
  hermes) run_hermes ;;
  openclaw) run_openclaw ;;
  all)
    run_hermes
    run_openclaw
    run_opencode
    ;;
  *)
    echo "usage: $0 [opencode|hermes|openclaw|all]"
    exit 2
    ;;
esac
echo "desk-agent-run done agent=$AGENT surfaces=ensured"
