#!/bin/bash
# Fog stay-awake v7 — idle sleep off while logged in; recover Fog after lid-wake.
# Suspended ≠ powered off. CPU-halt sleep cannot run workerd; we prevent idle
# sleep and kickstart :8787/:8788 within 2 min of wake (so 30 min fallback does not trip).
# Lid + battery will still sleep. On charger, optional sudo disablesleep.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
FOG="${STRATAMESH_HOME:-$HOME/StrataMesh}/fog"
LAUNCH="$HOME/Library/LaunchAgents"
UIDN="$(id -u)"
mkdir -p "$FOG/bin" "$FOG/log" "$LAUNCH"

SELF="$(cd "$(dirname "$0")" && pwd)"
SRC="$SELF/fog-awake.sh"
[[ -f "$SRC" ]] || SRC="$FOG/repo/deploy/mac-fog/fog-awake.sh"
[[ -f "$SRC" ]] || { echo "fog-awake.sh missing"; read -r _; exit 1; }
cp -f "$SRC" "$FOG/bin/fog-awake.sh"
chmod 755 "$FOG/bin/fog-awake.sh"

cat > "$LAUNCH/pt.calhegasmorais.fog-awake.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>pt.calhegasmorais.fog-awake</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-ims</string>
    <string>/bin/bash</string>
    <string>$FOG/bin/fog-awake.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FOG_HOME</key><string>$FOG</string>
  </dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$FOG/log/fog-awake.out</string>
  <key>StandardErrorPath</key><string>$FOG/log/fog-awake.err</string>
</dict></plist>
EOF

launchctl bootout "gui/${UIDN}/pt.calhegasmorais.fog-awake" 2>/dev/null || true
launchctl bootstrap "gui/${UIDN}" "$LAUNCH/pt.calhegasmorais.fog-awake.plist" 2>/dev/null \
  || launchctl load "$LAUNCH/pt.calhegasmorais.fog-awake.plist"
launchctl kickstart -k "gui/${UIDN}/pt.calhegasmorais.fog-awake" 2>/dev/null || true

# AC: no idle sleep. -n = no password prompt (skip if sudo needs TTY).
sudo -n pmset -c sleep 0 disksleep 0 tcpkeepalive 1 ttyskeepawake 1 powernap 1 womp 1 2>/dev/null || true

echo "fog-awake loaded (caffeinate -ims + 2 min wake kick)."
echo "Does not kill macbook-server. Lid+battery still sleeps (hardware)."
echo "On charger, lid-closed stay-up:  sudo pmset -c disablesleep 1"
pmset -g assertions 2>/dev/null | grep -i -e caffeinate -e PreventUserIdle -e PreventSystem || true

export FOG_HOME="$FOG"
TUI="$FOG/bin/fog-tui.py"
[[ -f "$TUI" ]] || TUI="$FOG/repo/deploy/mac-fog/fog-tui.py"
if [[ -f "$TUI" ]]; then
  exec /usr/bin/caffeinate -ims python3 "$TUI"
fi
