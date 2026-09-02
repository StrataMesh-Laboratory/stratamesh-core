#!/bin/bash
# StrataMesh LAB Fog Node installer v0.3.0
# No secrets in this file. Node id + tokens live in ~/.config/stratamesh.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export COPYFILE_DISABLE=1

ROOT="${STRATAMESH_HOME:-$HOME/StrataMesh}"
FOG="$ROOT/fog"
SRC="$FOG/src"
DATA="$FOG/data"
SECRETS="$HOME/.config/stratamesh"
LAUNCH="$HOME/Library/LaunchAgents"
REPO="${REPO_URL:-https://github.com/StrataMesh-Laboratory/stratamesh-core.git}"
CF_VER="${CLOUDFLARED_VERSION:-2026.8.2}"
NODE_ID="${FOG_NODE_ID:-}"
if [[ -z "$NODE_ID" && -f "$SECRETS/node.id" ]]; then
  NODE_ID="$(tr -d '[:space:]' < "$SECRETS/node.id")"
fi
NODE_ID="${NODE_ID:-UNREGISTERED}"
if [[ "$NODE_ID" == "FOG-NODE-PT-CM-001" ]]; then
  ORIGIN="${FOG_ORIGIN:-macbook}"
  AGENT="pt.calhegasmorais.fog"
  MESH_N="${FOG_MESH_N:-2}"
else
  ORIGIN="${FOG_ORIGIN:-local}"
  AGENT="lab.stratamesh.fog"
  MESH_N="${FOG_MESH_N:-1}"
fi

say() { printf "\n== %s ==\n" "$*"; }
die() { printf "FAIL: %s\n" "$*" >&2; exit 1; }

printf "\n  STRATAMESH LAB  ·  Fog Node v0.5.1-lab\n"
printf "  Intelligentia · Vigilantia · Veritas\n"
printf "  node=%s  origin=%s  agent=%s\n" "$NODE_ID" "$ORIGIN" "$AGENT"
printf "  lab · not mainnet · secrets never in git\n\n"

osascript -e 'display notification "StrataMesh LAB Fog Node v0.5.1-lab" with title "Installer"' >/dev/null 2>&1 || true

say "1/9 host"
ARCH=$(uname -m)
[[ "$ARCH" == "arm64" || "$ARCH" == "x86_64" ]] || die "unsupported arch $ARCH"
mkdir -p "$FOG" "$DATA" "$SECRETS" "$LAUNCH" "$FOG/bin" "$FOG/log"
echo "arch=$ARCH home=$FOG"

say "2/9 python 3.11+ (skip Xcode stub)"
PY=""
for c in python3.13 python3.12 python3.11 python3; do
  if command -v "$c" >/dev/null 2>&1; then
    v=$("$c" -c 'import sys; print("%d.%d"%sys.version_info[:2])')
    case "$v" in 3.1[1-9]|3.[2-9]*) PY=$c; break ;; esac
  fi
done
if [[ -z "$PY" ]]; then
  command -v brew >/dev/null 2>&1 || die "install Python 3.11+ from python.org or brew, then re-run"
  brew install python@3.12
  PY=$(command -v python3.12 || command -v python3)
fi
echo "python=$PY $($PY --version)"

say "3/9 clone/pull stratamesh-core"
if [[ -d "$FOG/repo/.git" ]]; then
  git -C "$FOG/repo" pull --ff-only || true
else
  git clone --depth 1 "$REPO" "$FOG/repo"
fi
ln -sfn "$FOG/repo/src" "$SRC"
mkdir -p "$FOG/workerd-config"
SRCW="$FOG/repo/ops/workerd/worker.js"
DSTW="$FOG/workerd-config/worker.js"
cp -f "$SRCW" "$DSTW"
python3 - "$FOG/repo/ops/workerd/config.capnp" "$FOG/workerd-config/config.capnp" "$ORIGIN" <<'PY'
import sys
from pathlib import Path
src, dest, origin = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
text = src.read_text()
for old in ('session', 'macbook', 'local', 'edge'):
    needle = 'text = "%s"' % old
    if needle in text:
        text = text.replace(needle, 'text = "%s"' % origin, 1)
        break
else:
    raise SystemExit("ORIGIN binding missing in config.capnp")
dest.write_text(text)
PY
[[ -f "$FOG/workerd-config/config.capnp" ]] || die "workerd-config write failed"
grep -q "text = \"$ORIGIN\"" "$FOG/workerd-config/config.capnp" || die "ORIGIN not $ORIGIN"

say "4/9 venv + psutil"
"$PY" -m venv "$FOG/venv"
"$FOG/venv/bin/pip" install -q --upgrade pip
"$FOG/venv/bin/pip" install -q psutil || true

say "5/9 workerd (OSS runtime, plugin-owned on :8788)"
if ! command -v npm >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 || die "need node/npm (brew install node) for workerd"
  brew install node
fi
npm install --prefix "$FOG/workerd-runtime" workerd --no-fund --no-audit
WD="$FOG/workerd-runtime/node_modules/.bin/workerd"
[[ -x "$WD" ]] || die "workerd binary missing"
"$WD" --version || true

say "6/9 cloudflared $CF_VER"
if [[ "$ARCH" == "arm64" ]]; then CF_ARCH=arm64; else CF_ARCH=amd64; fi
CF_URL="https://github.com/cloudflare/cloudflared/releases/download/${CF_VER}/cloudflared-darwin-${CF_ARCH}.tgz"
TMPCF=$(mktemp -d)
curl -fsSL "$CF_URL" -o "$TMPCF/cf.tgz"
tar -xzf "$TMPCF/cf.tgz" -C "$TMPCF"
CFBIN=$(find "$TMPCF" -type f -name 'cloudflared' | head -1)
[[ -n "$CFBIN" ]] || die "cloudflared missing from tarball"
cp -f "$CFBIN" "$FOG/bin/cloudflared"
chmod 755 "$FOG/bin/cloudflared"
rm -rf "$TMPCF"
"$FOG/bin/cloudflared" --version || true

say "7/9 tunnel token (local file only — optional)"
TOKFILE="$SECRETS/tunnel.token"
if [[ ! -s "$TOKFILE" ]]; then
  echo "no named-tunnel token on disk — this Fog stays local until you add $TOKFILE"
else
  chmod 600 "$TOKFILE"
fi

say "8/9 LaunchAgents — fog KeepAlive (owns workerd via plugin)."
MAC_LIVE=false
[[ "$ORIGIN" == "macbook" ]] && MAC_LIVE=true
cat > "$LAUNCH/${AGENT}.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$AGENT</string>
  <key>WorkingDirectory</key><string>$SRC</string>
  <key>ProgramArguments</key>
  <array>
    <string>$FOG/venv/bin/python3</string>
    <string>$SRC/node_persistent.py</string>
    <string>--port</string><string>8787</string>
    <string>--db</string><string>$DATA/fog.db</string>
    <string>--id</string><string>$NODE_ID</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FOG_DATA</key><string>$DATA</string>
    <key>FOG_SRC</key><string>$FOG/repo</string>
    <key>WORKERD_BIN</key><string>$WD</string>
    <key>WORKERD_PORT</key><string>8788</string>
    <key>WORKERD_CONFIG</key><string>$FOG/workerd-config/config.capnp</string>
    <key>FOG_ORIGIN</key><string>$ORIGIN</string>
    <key>FOG_MAC_LIVE</key><string>$MAC_LIVE</string>
    <key>FOG_MESH_N</key><string>$MESH_N</string>
    <key>FOG_NODE_ID</key><string>$NODE_ID</string>
    <key>PYTHONUNBUFFERED</key><string>1</string>
  </dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$FOG/log/fog.out</string>
  <key>StandardErrorPath</key><string>$FOG/log/fog.err</string>
</dict></plist>
EOF

# Optional belt: workerd LaunchAgent. Not loaded — fog plugin owns :8788 so reboot
# (POST /workerd/reboot, local-only) does not fight launchd KeepAlive.
cat > "$LAUNCH/pt.calhegasmorais.workerd.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>pt.calhegasmorais.workerd</string>
  <key>WorkingDirectory</key><string>$FOG/workerd-config</string>
  <key>ProgramArguments</key>
  <array>
    <string>$WD</string>
    <string>serve</string>
    <string>$FOG/workerd-config/config.capnp</string>
  </array>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$FOG/log/workerd.out</string>
  <key>StandardErrorPath</key><string>$FOG/log/workerd.err</string>
</dict></plist>
EOF

cat > "$FOG/bin/run-tunnel.sh" <<'EOS'
#!/bin/bash
set -euo pipefail
export TUNNEL_TOKEN="$(cat "$HOME/.config/stratamesh/tunnel.token")"
exec "$(dirname "$0")/cloudflared" tunnel --no-autoupdate run
EOS
chmod 700 "$FOG/bin/run-tunnel.sh"
cat > "$LAUNCH/pt.calhegasmorais.tunnel.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>pt.calhegasmorais.tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>$FOG/bin/run-tunnel.sh</string>
  </array>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$FOG/log/tunnel.out</string>
  <key>StandardErrorPath</key><string>$FOG/log/tunnel.err</string>
</dict></plist>
EOF

# Auto-update every 1800s. RunAtLoad false. Never tunnel/cloudflared. Never brew upgrade.
cp -f "$FOG/repo/deploy/mac-fog/fog-auto-update.sh" "$FOG/bin/fog-auto-update.sh"
chmod 755 "$FOG/bin/fog-auto-update.sh"
AU="pt.calhegasmorais.fog-auto-update"
cat > "$LAUNCH/${AU}.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$AU</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$FOG/bin/fog-auto-update.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FOG_HOME</key><string>$FOG</string>
    <key>FOG_ORIGIN</key><string>$ORIGIN</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$FOG/log/auto-update.log</string>
  <key>StandardErrorPath</key><string>$FOG/log/auto-update.log</string>
</dict></plist>
EOF
launchctl bootout "gui/$(id -u)/${AU}" 2>/dev/null || true
launchctl unload "$LAUNCH/${AU}.plist" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCH/${AU}.plist" 2>/dev/null \
  || launchctl load "$LAUNCH/${AU}.plist"

launchctl unload "$LAUNCH/${AGENT}.plist" 2>/dev/null || true
launchctl unload "$LAUNCH/pt.calhegasmorais.workerd.plist" 2>/dev/null || true
launchctl unload "$LAUNCH/pt.calhegasmorais.tunnel.plist" 2>/dev/null || true
launchctl load "$LAUNCH/${AGENT}.plist"
cp -f "$FOG/repo/deploy/mac-fog/fog-tui.py" "$FOG/bin/fog-tui.py"
cp -f "$FOG/repo/deploy/mac-fog/fog-awake.sh" "$FOG/bin/fog-awake.sh"
chmod 755 "$FOG/bin/fog-tui.py" "$FOG/bin/fog-awake.sh" \
  "$FOG/repo/deploy/mac-fog/FogRuntime.command" \
  "$FOG/repo/deploy/mac-fog/FogStayAwake.command" 2>/dev/null || true
AWAKE="${AGENT}-awake"
cat > "$LAUNCH/${AWAKE}.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$AWAKE</string>
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
launchctl bootout "gui/$(id -u)/${AWAKE}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCH/${AWAKE}.plist" 2>/dev/null \
  || launchctl load "$LAUNCH/${AWAKE}.plist"
echo
echo "This Mac’s loopback: workerd :8788 → fog :8787 (FOG_ORIGIN=macbook)."
echo "Public fog.calhegasmorais.pt rides macbook-server. HOLD fog-lab tunnel plist."
echo "Runtime UI: $FOG/bin/fog-tui.py  (q quit · s stop · b reboot · g pull+reboot · 15s)"
echo "Stay-awake:  FogStayAwake.command  (caffeinate -ims + 2min wake kick)"
bash "$FOG/repo/deploy/mac-fog/build-apps.sh" || echo "build-apps skipped (run on Mac)"

say "9/9 health"
sleep 3
curl -sf -m 5 http://127.0.0.1:8787/health && echo "  fog :8787 ok" || echo "  fog starting…"
curl -sf -m 5 http://127.0.0.1:8788/workerd && echo "  workerd :8788 ok" || echo "  workerd starting (fog plugin)…"
echo
echo "Layer: workerd :8788 → fog :8787  (public via macbook-server)"
echo "Stop fog:  $(dirname "$0")/stop-fog.command   or  s  in the runtime UI"
echo "Reboot:    b  in the runtime UI (kickstart fog+workerd, keeps macbook-server)"
echo "LAB n=2  mesh_member=true  f_max=0  v7"
export FOG_HOME="$FOG"
osascript <<APP >/dev/null 2>&1 || true
tell application "Terminal"
  activate
  do script "export FOG_HOME='$FOG'; exec python3 '$FOG/bin/fog-tui.py'"
end tell
APP
open "$FOG/log" >/dev/null 2>&1 || true
