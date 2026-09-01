#!/bin/zsh
# Fog Tailscale — never commit the auth key.
# Secret: ~/.config/stratamesh/tailscale.authkey  (tskey-auth-...)
set -e
VAULT="$HOME/.config/stratamesh"
KEYF="$VAULT/tailscale.authkey"
mkdir -p "$VAULT"
chmod 700 "$VAULT"

if ! command -v tailscale >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install --cask tailscale
  else
    echo "install Tailscale.app from https://tailscale.com/download/mac then re-run"
    exit 1
  fi
fi

# GUI app must be opened once on macOS
open -a Tailscale 2>/dev/null || true
sleep 2

if [[ -f "$KEYF" ]] && [[ $(wc -c < "$KEYF") -gt 20 ]]; then
  KEY=$(tr -d '[:space:]' < "$KEYF")
  sudo tailscale up --auth-key="$KEY" --hostname="fog-cmn-mbpa" --accept-routes=false --ssh
else
  echo "no $KEYF"
  echo "create reusable/ephemeral auth key at https://login.tailscale.com/admin/settings/keys"
  echo "umask 077; printf '%s\\n' 'tskey-auth-...' > $KEYF; chmod 600 $KEYF"
  echo "then re-run this script"
  exit 2
fi

tailscale status
tailscale ip -4
