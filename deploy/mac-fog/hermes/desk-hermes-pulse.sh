#!/bin/bash
# Hermes desktop pulse — native desk on Mac (not STRATAGROK box).
set -euo pipefail
export FOG_SRC="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
export FOG_HOME="${FOG_HOME:-$HOME/StrataMesh/fog}"
cd "$FOG_SRC"
exec bash deploy/mac-fog/desk-agent-run.sh hermes
