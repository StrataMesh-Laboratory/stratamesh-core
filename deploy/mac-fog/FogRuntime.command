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
exec /usr/bin/caffeinate -ims python3 "$TUI"
