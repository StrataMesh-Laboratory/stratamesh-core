#!/bin/bash
# Stop Mac Fog + workerd. Does NOT kill macbook-server cloudflared (public fog).
set -euo pipefail
LAUNCH="$HOME/Library/LaunchAgents"
UIDN="$(id -u)"
for l in pt.calhegasmorais.fog pt.calhegasmorais.workerd pt.calhegasmorais.fog-awake; do
  launchctl bootout "gui/${UIDN}/${l}" 2>/dev/null || true
  launchctl unload "$LAUNCH/${l}.plist" 2>/dev/null || true
  echo "unloaded $l"
done
# fog-lab tunnel agent only — not macbook-server
launchctl bootout "gui/${UIDN}/pt.calhegasmorais.tunnel" 2>/dev/null || true
launchctl unload "$LAUNCH/pt.calhegasmorais.tunnel.plist" 2>/dev/null || true
pkill -x workerd 2>/dev/null || true
echo "fog stopped. macbook-server cloudflared left running."
