#!/bin/bash
# Run ONE desk specialty — serialized on 8GB Fog Mac (never stack Hermes+OpenClaw+OpenCode).
# Usage: bash deploy/mac-fog/desk-agent-run.sh [opencode|hermes|openclaw|fog|edge]
# Cycle (desk_ops.py cycle) is TUI `r` / desk_ops only — specialty runners must NOT call it
# (that pulled live Hermes/claw Acts under an OpenCode smoke).
# Respects metabol pace via desk_ops HOLD file.
set -euo pipefail
REPO="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
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
  echo "OpenCode: CONTEXT + TODO.md + reports/ → specialty=code (unittest/compile)"
  if [[ -f "$BRIEF" ]]; then
    echo "OpenCode consuming brief: $BRIEF"
    head -40 "$BRIEF" || true
  else
    echo "OpenCode: no opencode-next.md yet — cycle will write one"
  fi
  # Real work only — no desk_ops cycle (would pull Hermes/claw)
  python3 -m compileall -q ops/desk-collegium || true
  python3 -m unittest discover -s ops/desk-collegium -p 'test_desk_*.py' -q || true
  python3 - << PY
import json, time
from pathlib import Path
p = Path("$FOG/data/desk-meters/opencode.json")
p.write_text(json.dumps({
  "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
  "brief": "opencode-next.md",
  "model": "unittest+compileall",
  "status": "ran_unittest_subset",
  "wake": "CONTEXT→protocol→TODO→reports→code",
  "serialized": True,
}, indent=2) + "\n")
print(p)
PY
}

run_hermes() {
  HPY="$HOME/.hermes/hermes-agent/venv/bin/python"
  [[ -x "$HPY" ]] || HPY=python3
  "$HPY" "$REPO/deploy/mac-fog/hermes/ensure_workspace.py" || true
  BRIEF="$FOG/data/desk-outbox/hermes-next.md"
  python3 ops/desk-collegium/desk_protocol.py check || true
  python3 ops/desk-collegium/desk_ops.py board || true
  python3 ops/desk-collegium/desk_reports.py sync || true
  # No run_ops cycle here — TUI r owns cycle; keeps serialize
  echo "Hermes: native Mac desk — Bot=escalate only; self-queue coord from TODO.md"
  echo "Mail: automation.desk@calhegasmorais.pt shared — imap/smtp paths ~/.config/stratagrok/"
  [[ -f "$BRIEF" ]] && echo "Hermes brief: $BRIEF"
  python3 - << PY
import json, time, subprocess
from pathlib import Path
p = Path("$FOG/data/desk-meters/hermes.json")
cur = {}
if p.is_file():
  try: cur = json.loads(p.read_text())
  except Exception: cur = {}
ctx = int(cur.get("context_length") or cur.get("context") or 0)
if not ctx:
  cur["context_length"] = 65536
  cur["note"] = "default prefer ≥64k; set real window after ollama model"
# Prefer live hermes config model.default when available
try:
  r = subprocess.run(["hermes", "config", "get", "model.default"], capture_output=True, text=True, timeout=30)
  line = (r.stdout or "").strip().splitlines()[-1] if r.stdout else ""
  if ":" in line and "model.default" in line:
    line = line.split(":", 1)[-1].strip().strip(chr(34)+chr(39))
  if line and " " not in line and len(line) < 80:
    cur["model"] = line
except Exception:
  pass
cur["ts"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
cur["serialized"] = True
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(cur, indent=2) + "\n")
print("hermes meter context_length=", cur.get("context_length"), "model=", cur.get("model"))
PY
  ls -la "$FOG/data/desk-outbox/TODO.md" "$FOG/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md" 2>/dev/null || true
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
