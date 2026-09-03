#!/bin/bash
# StrataMesh Fog runtime UI v0.5.0-lab — Node Launcher — workerd :8788 + python :8790 + node :8791 middleware.
# q quit · s stop · b reboot · g git pull+reboot.
set -euo pipefail
export FOG_ORIGIN="${FOG_ORIGIN:-macbook}" FOG_MESH_N="${FOG_MESH_N:-2}" FOG_FALLBACK_AFTER="${FOG_FALLBACK_AFTER:-1800}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
FOG="${STRATAMESH_HOME:-$HOME/StrataMesh}/fog"
TUI="$FOG/bin/fog-tui.py"
[[ -f "$TUI" ]] || TUI="$FOG/repo/deploy/mac-fog/fog-tui.py"
[[ -f "$TUI" ]] || { echo "fog-tui.py missing"; read -r _; exit 1; }
export FOG_HOME="$FOG"
export OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
ensure_wizard_ollama() {
  # Stack import: brew ollama + serve. Never block TUI start on pull.
  command -v brew >/dev/null 2>&1 && { brew list ollama >/dev/null 2>&1 || brew install ollama >/dev/null 2>&1 || true; }
  if command -v ollama >/dev/null 2>&1; then
    if ! curl -sf --max-time 1 "${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
      ollama serve >/dev/null 2>&1 &
      disown 2>/dev/null || true
    fi
    ollama pull llama3.2:1b >/dev/null 2>&1 &
    disown 2>/dev/null || true
  fi
}
ensure_wizard_ollama || true
unset MallocStackLogging MallocStackLoggingNoCompact MallocStackLoggingDirectory \
      MallocScribble MallocGuardEdges MallocNanoZone || true
exec /usr/bin/caffeinate -ims python3 "$TUI" \
  2> >(grep -v -F 'MallocStackLogging' >&2 || true)
