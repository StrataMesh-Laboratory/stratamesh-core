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
unset MallocStackLogging MallocStackLoggingNoCompact MallocStackLoggingDirectory \
      MallocScribble MallocGuardEdges MallocNanoZone || true
exec /usr/bin/caffeinate -ims python3 "$TUI" \
  2> >(grep -v -F 'MallocStackLogging' >&2 || true)
