#!/bin/bash
# Stop Mac Fog + workerd + tunnel LaunchAgents (v3)
set -euo pipefail
LAUNCH="$HOME/Library/LaunchAgents"
for l in pt.calhegasmorais.tunnel pt.calhegasmorais.workerd pt.calhegasmorais.fog; do
  launchctl unload "$LAUNCH/${l}.plist" 2>/dev/null || true
  echo "unloaded $l"
done
# plugin-owned workerd may still be up after fog unload
pkill -f '/workerd serve' 2>/dev/null || true
echo "stopped. Token file left in ~/.config/stratamesh/tunnel.token"
