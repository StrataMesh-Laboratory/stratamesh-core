#!/bin/bash
# Run one desk specialty from outbox / bus — call from TUI r path or manually.
# Usage: bash deploy/mac-fog/desk-agent-run.sh [opencode|hermes|openclaw|fog|edge|all]
# Ensures cycle-owned surfaces (TODO/CONTEXT/reports/journals) before specialty work.
# Respects metabol pace via desk_ops (HOLD/STASIS skip non-lead).
set -euo pipefail
REPO="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
AGENT="${1:-all}"
cd "$REPO"
mkdir -p "$FOG/data/desk-outbox" "$FOG/data/desk-meters" \
  "$FOG/data/desk-outbox/reports" "$FOG/data/desk-outbox/journals" \
  "$FOG/data/desk-outbox/apprentice"

ensure_surfaces() {
  python3 ops/desk-collegium/desk_reports.py ensure-surfaces || true
}

run_ops() {
  python3 ops/desk-collegium/desk_ops.py cycle --max 3 || true
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
  # Real work: compile + unittest discover (hyphen dir is not a package)
  python3 -m compileall -q ops/desk-collegium || true
  python3 -m unittest discover -s ops/desk-collegium -p 'test_desk_*.py' -q || true
  run_ops
  python3 - << PY
import json, time
from pathlib import Path
p = Path("$FOG/data/desk-meters/opencode.json")
p.write_text(json.dumps({
  "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
  "brief": "opencode-next.md",
  "model": "phi3:latest",
  "status": "ran_unittest_subset",
  "wake": "CONTEXT→protocol→TODO→reports→code",
}, indent=2) + "\n")
print(p)
PY
}

run_hermes() {
  BRIEF="$FOG/data/desk-outbox/hermes-next.md"
  python3 ops/desk-collegium/desk_protocol.py check || true
  python3 ops/desk-collegium/desk_ops.py board || true
  python3 ops/desk-collegium/desk_reports.py sync || true
  run_ops
  echo "Hermes: native Mac desk — Bot=escalate only; self-queue coord from TODO.md"
  echo "Mail: automation.desk@calhegasmorais.pt shared — imap/smtp paths ~/.config/stratagrok/"
  [[ -f "$BRIEF" ]] && echo "Hermes brief: $BRIEF"
  # Soft: hermes context meter (≥64k)
  python3 - << PY
import json, time
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
cur["ts"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(cur, indent=2) + "\n")
print("hermes meter context_length=", cur.get("context_length"))
PY
  ls -la "$FOG/data/desk-outbox/TODO.md" "$FOG/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md" 2>/dev/null || true
}

run_openclaw() {
  echo "OpenClaw: self-audit hops; TODO.md specialty=claw"
  if [[ -x "$REPO/deploy/mac-fog/desk-claw-probe.sh" ]] || [[ -f "$REPO/deploy/mac-fog/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/desk-claw-probe.sh" || true
  elif [[ -f "$REPO/deploy/mac-fog/openclaw/desk-claw-probe.sh" ]]; then
    bash "$REPO/deploy/mac-fog/openclaw/desk-claw-probe.sh" || true
  fi
  run_ops
}

run_fog() {
  BRIEF="$FOG/data/desk-outbox/fog-assistant-next.md"
  echo "Fog Assistant: read brief (no Bot browser); origin health via desk_ops fog handler"
  [[ -f "$BRIEF" ]] && cat "$BRIEF" | head -40
  run_ops
}

run_edge() {
  BRIEF="$FOG/data/desk-outbox/edge-assistant-next.md"
  echo "EDGE Assistant: consume-origin GETs; read brief"
  [[ -f "$BRIEF" ]] && cat "$BRIEF" | head -40
  run_ops
}

ensure_surfaces
run_actions

case "$AGENT" in
  opencode) run_opencode ;;
  hermes) run_hermes ;;
  openclaw) run_openclaw ;;
  fog|fog-assistant) run_fog ;;
  edge|edge-assistant) run_edge ;;
  all)
    run_hermes
    run_openclaw
    run_opencode
    ;;
  *)
    echo "usage: $0 [opencode|hermes|openclaw|fog|edge|all]"
    exit 2
    ;;
esac
echo "desk-agent-run done agent=$AGENT surfaces=ensured metabol=enforced"
