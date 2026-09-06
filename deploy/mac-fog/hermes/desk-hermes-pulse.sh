#!/bin/bash
# Hermes desktop pulse — native desk on Mac (not STRATAGROK box).
# Ensures FOG-CMN-DESK workspace (discovery roots, listable session, model) then runs desk agent.
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$PATH"
export FOG_SRC="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
export FOG_HOME="${FOG_HOME:-$HOME/StrataMesh/fog}"
cd "$FOG_SRC"
PY="$HOME/.hermes/hermes-agent/venv/bin/python"
if [[ ! -x "$PY" ]]; then PY=python3; fi
"$PY" deploy/mac-fog/hermes/ensure_workspace.py || true
exec bash deploy/mac-fog/desk-agent-run.sh hermes
