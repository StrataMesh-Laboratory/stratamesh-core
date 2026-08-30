#!/bin/bash
# One-shot: pull repo, install Fog node, stay-awake agent, write .app bundles.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export COPYFILE_DISABLE=1
ROOT="${STRATAMESH_HOME:-$HOME/StrataMesh}"
REPO="$ROOT/fog/repo"
echo "== Fog Installer v7 =="
mkdir -p "$ROOT/fog"
if [[ -d "$REPO/.git" ]]; then
  git -C "$REPO" pull --ff-only || true
else
  git clone --depth 1 https://github.com/StrataMesh-Laboratory/stratamesh-core.git "$REPO"
fi
bash "$REPO/deploy/mac-fog/FogNodeInstaller.command"
bash "$REPO/deploy/mac-fog/build-apps.sh"
bash "$REPO/deploy/mac-fog/FogStayAwake.command" --no-tui
echo
echo "Apps:"
ls -d "$HOME/Applications/StrataMesh/"*.app /Applications/StrataMesh/*.app 2>/dev/null || true
echo
echo "Double-click  Fog Stay Awake  (Applications/StrataMesh)."
echo "On charger, lid-closed stay-up:  sudo pmset -c disablesleep 1"
read -r -p "press return " _ || true
