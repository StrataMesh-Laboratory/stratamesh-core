#!/bin/bash
# Hold sleep assertions + kick Fog after wake.
# True sleep still halts CPU; this prevents idle sleep and recovers :8787/:8788 on wake.
# Does not kill macbook-server cloudflared. Does not load fog-lab tunnel.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
UIDN="$(id -u)"
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
LOG="$FOG/log/fog-awake.log"
mkdir -p "$FOG/log"

kick() {
  launchctl kickstart -k "gui/${UIDN}/pt.calhegasmorais.fog" >/dev/null 2>&1 || true
}

alive() {
  curl -sf -m 2 "http://127.0.0.1:${1}/health" >/dev/null 2>&1
}

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) fog-awake start pid=$$" >>"$LOG"
while true; do
  if ! alive 8787 || ! alive 8788; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) kick fog (8787/8788 down after sleep/wake)" >>"$LOG"
    kick
  fi
  sleep 120
done
