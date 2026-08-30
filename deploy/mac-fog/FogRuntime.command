#!/bin/bash
# StrataMesh Fog runtime UI v7 — 15s. q quit · s stop · b reboot · g git pull+reboot.
# Wrapped in caffeinate -ims so idle sleep does not freeze Fog while this UI is open.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
FOG="${STRATAMESH_HOME:-$HOME/StrataMesh}/fog"
TUI="$FOG/bin/fog-tui.py"
[[ -f "$TUI" ]] || TUI="$FOG/repo/deploy/mac-fog/fog-tui.py"
[[ -f "$TUI" ]] || { echo "fog-tui.py missing"; read -r _; exit 1; }
export FOG_HOME="$FOG"
# libmalloc: unset, never export =0 (that prints "can't turn off ... not enabled").
unset MallocStackLogging MallocStackLoggingNoCompact MallocStackLoggingDirectory \
      MallocScribble MallocGuardEdges MallocNanoZone || true
# Drop CPython/libmalloc startup chatter on fd 2; keep real errors.
# grep -v exits 1 when every line is noise — || true so exec still runs.
exec /usr/bin/caffeinate -ims python3 "$TUI" \
  2> >(grep -v -F 'MallocStackLogging' >&2 || true)
