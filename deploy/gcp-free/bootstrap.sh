#!/usr/bin/env bash
# Bootstrap StrataMesh Fog on GCP Always Free e2-micro (Ubuntu x86_64)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/StrataMesh-Laboratory/stratamesh-core.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/stratamesh-core}"
DATA_DIR="${DATA_DIR:-/var/lib/stratamesh}"
NODE_ID="${NODE_ID:-FOG-NODE-GCP-001}"

sudo apt-get update -y
sudo apt-get install -y python3 python3-venv git curl ufw fail2ban

sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  sudo git clone "$REPO_URL" "$INSTALL_DIR"
else
  sudo git -C "$INSTALL_DIR" pull --ff-only || true
fi
sudo chown -R "$USER:$USER" "$INSTALL_DIR"

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
# Tailscale UDP
sudo ufw allow 41641/udp || true
# Do NOT: ufw allow 8787
sudo ufw --force enable || true

echo "NODE_ID=$NODE_ID"
echo "Install Tailscale, then cloudflared if you need a named hostname."
echo "Copy deploy/gcp-free/stratamesh-fog.service → /etc/systemd/system/ and enable."
echo "Data dir: $DATA_DIR"
