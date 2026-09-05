#!/usr/bin/env bash
# Bootstrap Fog on homelab peer (Debian/Ubuntu ARM64 or x86_64)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/StrataMesh-Laboratory/stratamesh-core.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/stratamesh-core}"
DATA_DIR="${DATA_DIR:-/var/lib/stratamesh}"
NODE_ID="${NODE_ID:-FOG-NODE-HOME-001}"

if command -v apt-get >/dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y python3 python3-venv git curl ufw
fi

sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  sudo git clone "$REPO_URL" "$INSTALL_DIR"
else
  sudo git -C "$INSTALL_DIR" pull --ff-only || true
fi
sudo chown -R "$USER:$USER" "$INSTALL_DIR"

echo "Install Tailscale: https://tailscale.com/download"
echo "NODE_ID=$NODE_ID — copy stratamesh-fog.service and enable."
echo "Do not open public :8787; Tailscale only until tunnel exists."
