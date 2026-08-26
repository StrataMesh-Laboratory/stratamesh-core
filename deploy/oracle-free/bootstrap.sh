#!/usr/bin/env bash
# Bootstrap StrataMesh Fog on Oracle Always Free (Ubuntu)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/StrataMesh-Laboratory/stratamesh-core.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/stratamesh-core}"
DATA_DIR="${DATA_DIR:-/var/lib/stratamesh}"

sudo apt-get update -y
sudo apt-get install -y python3 python3-venv git curl ufw fail2ban

sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  sudo git clone "$REPO_URL" "$INSTALL_DIR"
else
  sudo git -C "$INSTALL_DIR" pull --ff-only || true
fi
sudo chown -R "$USER:$USER" "$INSTALL_DIR"

# Firewall: SSH only from anywhere is weak — prefer your IP
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
# Do NOT: ufw allow 8787
sudo ufw --force enable || true

echo "Install cloudflared for your arch from GitHub releases, then:"
echo "  cloudflared tunnel login"
echo "  cloudflared tunnel create stratamesh-fog"
echo "Copy deploy/oracle-free/*.service to /etc/systemd/system/ and enable."
echo "Data dir: $DATA_DIR"
