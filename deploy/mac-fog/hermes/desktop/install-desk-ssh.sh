#!/bin/bash
# Enable shared-desk SSH on Intel Mac (no Grok Bot app).
set -euo pipefail
echo "=== install-desk-ssh (Hermes shared desk machine) ==="

# Tailscale SSH
if command -v tailscale >/dev/null 2>&1; then
  tailscale set --ssh=true 2>/dev/null || tailscale up --ssh --accept-routes=false --reset=false 2>/dev/null || true
  echo "tailscale_ssh: attempted"
  tailscale status 2>/dev/null | head -15 || true
  echo "ts_ip4=$(tailscale ip -4 2>/dev/null || echo unknown)"
else
  echo "WARN: tailscale not in PATH"
fi

# Remote Login (sshd)
sudo systemsetup -setremotelogin on 2>/dev/null || true
sudo launchctl load -w /System/Library/LaunchDaemons/ssh.plist 2>/dev/null || true
echo "remote_login: attempted"

# authorized_keys dir
mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
touch "${HOME}/.ssh/authorized_keys"
chmod 600 "${HOME}/.ssh/authorized_keys"

# ssh config alias on Mac itself (loopback-friendly for agents on-box)
CFG="${HOME}/.ssh/config"
touch "$CFG"
chmod 600 "$CFG"
if ! grep -q 'Host hermes-desk' "$CFG" 2>/dev/null; then
  TSIP=$(tailscale ip -4 2>/dev/null || echo 100.108.35.26)
  cat >> "$CFG" <<CFG

# FOG-CMN-DESK shared machine (Hermes desktop)
Host hermes-desk
  HostName ${TSIP}
  User $(whoami)
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
CFG
  echo "ssh_config: hermes-desk -> ${TSIP}"
else
  echo "ssh_config: hermes-desk already present"
fi

DESK="/Users/andremorais/StrataMesh/fog/repo/deploy/mac-fog/hermes/desktop"
if [ -d "$DESK" ]; then
  echo "HERMES_DESK_OK path=$DESK"
else
  echo "WARN: Hermes desktop path missing — pull fog repo / g first"
fi

echo "READY hermes-desk user=$(whoami) ts=$(tailscale ip -4 2>/dev/null || echo n/a)"
echo "Next: append desk agent .pub to ~/.ssh/authorized_keys; from box: tailscale ssh $(whoami)@mbpv"
