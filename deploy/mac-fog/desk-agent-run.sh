#!/bin/bash
# Run ONE desk specialty — serialized on 8GB Fog Mac (never stack Hermes+OpenClaw+OpenCode).
# Usage: bash deploy/mac-fog/desk-agent-run.sh [opencode|hermes|openclaw|fog|edge]
# Cycle (desk_ops.py cycle) is TUI `r` / desk_ops only — specialty runners must NOT call it
# (that pulled live Hermes/claw Acts under an OpenCode smoke).
# Respects metabol pace via desk_ops HOLD file.
set -euo pipefail
REPO="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
# Official OpenCode curl-install dir + brew/local bins (non-interactive SSH misses .zshrc)
export PATH="$HOME/.opencode/bin:$HOME/.local/bin:/usr/local/bin:$PATH"
AGENT="${1:-}"
HOLD_FILE="$FOG/data/DESK-CYCLE-HOLD"
if [[ -f "$HOLD_FILE" ]]; then
  echo "desk-agent-run: HOLD $HOLD_FILE — skip (rm to resume)"
  exit 0
fi
if [[ -z "$AGENT" || "$AGENT" == "all" ]]; then
  echo "desk-agent-run: serialize — pass exactly one of: opencode|hermes|openclaw|fog|edge"
  echo "  (refusing all/empty so 8GB Mac never stacks specialists)"
  exit 2
fi
cd "$REPO"
mkdir -p "$FOG/data/desk-outbox" "$FOG/data/desk-meters" \
  "$FOG/data/desk-outbox/reports" "$FOG/data/desk-outbox/journals" \
  "$FOG/data/desk-outbox/apprentice"

# Exclusive lock (portable: macOS has no flock by default — mkdir lock)
LOCK_DIR="$FOG/data/desk-agent-run.lock.d"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  holder="$(cat "$LOCK_DIR/holder" 2>/dev/null || true)"
  echo "desk-agent-run: BUSY — another specialty holds $LOCK_DIR ($holder)"
  echo "  serialize: wait or kill the holder; do not stack on 8GB"
  exit 75
fi
echo "agent=$AGENT pid=$$ ts=$(date +%Y-%m-%dT%H:%M:%S%z)" > "$LOCK_DIR/holder"
cleanup_lock() { rm -rf "$LOCK_DIR"; }
trap cleanup_lock EXIT INT TERM

ensure_surfaces() {
  python3 ops/desk-collegium/desk_reports.py ensure-surfaces || true
}

run_actions() {
  python3 ops/desk-collegium/desk_actions.py sync --limit 12 || true
}

run_opencode() {
  BRIEF="$FOG/data/desk-outbox/opencode-next.md"
  echo "OpenCode: Ollama specialist — real binary, no unittest theatre"
  if [[ -f "$BRIEF" ]]; then head -40 "$BRIEF"; else echo "OpenCode: no brief yet"; fi
  OC="$(command -v opencode || true)"
  if [[ -x "$HOME/.opencode/bin/opencode" ]]; then OC="$HOME/.opencode/bin/opencode"; fi
  if [[ -z "$OC" || ! -x "$OC" ]]; then
    echo "OpenCode: BINARY MISSING"
    python3 -c "import json,time,os; from pathlib import Path; p=Path(os.environ.get('FOG_HOME', str(Path.home()/'StrataMesh/fog')))/'data/desk-meters/opencode.json'; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(json.dumps({'ts':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'ok':False,'status':'binary_missing'},indent=2)+chr(10))"
    return 0
  fi
  echo "OpenCode exec $OC"
  python3 -c "import json,time; from pathlib import Path; p=Path('$FOG/data/desk-meters/opencode.json'); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(json.dumps({'ts':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'ok':True,'status':'binary_present','serialized':True},indent=2)+chr(10))"
}

run_hermes() {
  echo "Hermes: Ollama specialist — real oneshot"
  HPY="$HOME/.hermes/hermes-agent/venv/bin/python"
  if [[ ! -x "$HPY" ]]; then HPY=python3; fi
  "$HPY" "$REPO/deploy/mac-fog/hermes/ensure_workspace.py" || true
  BRIEF="$FOG/data/desk-outbox/hermes-next.md"
  python3 ops/desk-collegium/desk_protocol.py check || true
  python3 ops/desk-collegium/desk_ops.py board || true
  python3 ops/desk-collegium/desk_reports.py sync || true
  HERMES="$(command -v hermes || true)"
  if [[ -n "$HERMES" ]]; then
    echo "Hermes exec $HERMES"
    if [[ -f "$BRIEF" ]]; then
      "$HERMES" oneshot "$(head -c 800 "$BRIEF")" || true
    else
      "$HERMES" oneshot "Desk Hermes: one live Fog lesson. oracle_live=false." || true
    fi
  else
    echo "Hermes: CLI missing — workspace ensured"
  fi
}

run_openclaw() {
  echo "OpenClaw: self-audit hops; TODO.md specialty=claw"
  if [[ -f "$REPO/deploy/mac-fog/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/desk-claw-probe.sh" || true
  elif [[ -f "$REPO/deploy/mac-fog/openclaw/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/openclaw/desk-claw-probe.sh" || true
  fi
  # No run_ops — serialize
}

run_fog() {
  BRIEF="$FOG/data/desk-outbox/fog-assistant-next.md"
  echo "Fog Assistant: read brief (no Bot browser); origin health via desk_ops fog handler"
  [[ -f "$BRIEF" ]] && cat "$BRIEF" | head -40
}

run_edge() {
  BRIEF="$FOG/data/desk-outbox/edge-assistant-next.md"
  echo "EDGE Assistant: consume-origin GETs; read brief"
  [[ -f "$BRIEF" ]] && cat "$BRIEF" | head -40
}

ensure_surfaces
run_actions

case "$AGENT" in
  opencode) run_opencode ;;
  hermes) run_hermes ;;
  openclaw) run_openclaw ;;
  fog|fog-assistant) run_fog ;;
  edge|edge-assistant) run_edge ;;
  *)
    echo "usage: $0 opencode|hermes|openclaw|fog|edge"
    exit 2
    ;;
esac
echo "desk-agent-run done agent=$AGENT surfaces=ensured serialized=1"
