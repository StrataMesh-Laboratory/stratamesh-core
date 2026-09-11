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

finish_agent() {
  # $1 agent  $2 ok  $3 result  $4 optional evidence path
  python3 "$REPO/ops/desk-collegium/desk_agent_finish.py" \
    --agent "$1" --ok "$2" --result "$3" ${4:+--evidence "$4"} || true
}

run_opencode() {
  BRIEF="$FOG/data/desk-outbox/opencode-next.md"
  LOG="$FOG/data/desk-meters/opencode-last.log"
  echo "OpenCode: Ollama specialist — real binary, no unittest theatre"
  if [[ -f "$BRIEF" ]]; then head -40 "$BRIEF"; else echo "OpenCode: no brief yet"; fi
  OC="$(command -v opencode || true)"
  if [[ -x "$HOME/.opencode/bin/opencode" ]]; then OC="$HOME/.opencode/bin/opencode"; fi
  if [[ -z "$OC" || ! -x "$OC" ]]; then
    echo "OpenCode: BINARY MISSING"
    finish_agent opencode 0 "BINARY MISSING — not done"
    return 0
  fi
  if [[ ! -f "$BRIEF" ]]; then
    finish_agent opencode 0 "no opencode-next.md brief — not done"
    return 0
  fi
  echo "OpenCode exec $OC on brief"
  set +e
  if "$OC" run --prompt "$(head -c 2000 "$BRIEF")" >"$LOG" 2>&1; then
    RC=0
  else
    RC=$?
  fi
  set -e
  if [[ "$RC" -eq 0 && -s "$LOG" ]]; then
    finish_agent opencode 1 "opencode run wrote log rc=0" "$LOG"
  else
    finish_agent opencode 0 "opencode run rc=$RC or empty log — not done" "$LOG"
  fi
}

run_hermes() {
  echo "Hermes: Ollama specialist — real oneshot"
  HPY="$HOME/.hermes/hermes-agent/venv/bin/python"
  if [[ ! -x "$HPY" ]]; then HPY=python3; fi
  "$HPY" "$REPO/deploy/mac-fog/hermes/ensure_workspace.py" || true
  BRIEF="$FOG/data/desk-outbox/hermes-next.md"
  JOURNAL_DIR="$FOG/data/desk-outbox/journals/hermes"
  mkdir -p "$JOURNAL_DIR"
  python3 ops/desk-collegium/desk_protocol.py check || true
  python3 ops/desk-collegium/desk_ops.py board || true
  python3 ops/desk-collegium/desk_reports.py sync || true
  HERMES="$(command -v hermes || true)"
  if [[ -z "$HERMES" ]]; then
    echo "Hermes: CLI missing — not done"
    finish_agent hermes 0 "CLI missing — workspace only is not an Act"
    return 0
  fi
  echo "Hermes exec $HERMES"
  set +e
  if [[ -f "$BRIEF" ]]; then
    "$HERMES" oneshot "$(head -c 800 "$BRIEF")"
    RC=$?
  else
    "$HERMES" oneshot "Desk Hermes: one live Fog lesson. oracle_live=false."
    RC=$?
  fi
  set -e
  # evidence = newest journal in this tick window
  EV="$(ls -t "$JOURNAL_DIR"/* 2>/dev/null | head -1 || true)"
  if [[ "$RC" -eq 0 && -n "$EV" && -s "$EV" ]]; then
    finish_agent hermes 1 "hermes oneshot rc=0 journal=$(basename "$EV")" "$EV"
  else
    finish_agent hermes 0 "hermes oneshot rc=$RC or no journal — not done" "$EV"
  fi
}

run_openclaw() {
  echo "OpenClaw: hop probe; TODO.md specialty=claw"
  METER="$FOG/data/desk-meters/openclaw.json"
  LOG="$FOG/data/desk-meters/openclaw-last.log"
  set +e
  if [[ -f "$REPO/deploy/mac-fog/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/desk-claw-probe.sh" >"$LOG" 2>&1
    RC=$?
  elif [[ -f "$REPO/deploy/mac-fog/openclaw/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/openclaw/desk-claw-probe.sh" >"$LOG" 2>&1
    RC=$?
  else
    RC=127
    echo "desk-claw-probe.sh missing" >"$LOG"
  fi
  set -e
  EV="$METER"
  [[ -s "$LOG" ]] && EV="$LOG"
  if [[ "$RC" -eq 0 && -s "$EV" ]]; then
    finish_agent openclaw 1 "claw probe rc=0" "$EV"
  else
    finish_agent openclaw 0 "claw probe rc=$RC or empty evidence — not done" "$EV"
  fi
}

run_fog() {
  BRIEF="$FOG/data/desk-outbox/fog-assistant-next.md"
  echo "Fog Assistant: read brief (no Bot browser); origin health via desk_ops fog handler"
  [[ -f "$BRIEF" ]] && cat "$BRIEF" | head -40
  finish_agent fog 0 "fog-assistant consume-only this tick — cycle apply_result is the closer"
}

run_edge() {
  BRIEF="$FOG/data/desk-outbox/edge-assistant-next.md"
  echo "EDGE Assistant: consume-origin GETs; read brief"
  [[ -f "$BRIEF" ]] && cat "$BRIEF" | head -40
  finish_agent edge 0 "edge-assistant consume-only this tick — cycle apply_result is the closer"
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
