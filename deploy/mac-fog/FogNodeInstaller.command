#!/bin/bash
# StrataMesh Fog Mac installer v5 — THIS Mac’s workerd :8788 + runtime UI
# Double-click in Finder. No secrets in this file.
# Mac origin:  Mac 127.0.0.1:8788 → Mac 127.0.0.1:8787
# Do not load fog-lab tunnel plist; public fog rides existing macbook-server connector.
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
NODE_ID="FOG-NODE-PT-CM-001"

say() { printf "\n== %s ==\n" "$*"; }
die() { printf "FAIL: %s\n" "$*" >&2; exit 1; }

osascript -e 'display notification "StrataMesh Fog v5 — runtime UI" with title "Installer"' >/dev/null 2>&1 || true

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
cp -f "$FOG/repo/ops/workerd/worker.js" "$FOG/workerd-config/worker.js"
python3 - "$FOG/repo/ops/workerd/config.capnp" "$FOG/workerd-config/config.capnp" <<'PY'
import sys
from pathlib import Path
src, dest = Path(sys.argv[1]), Path(sys.argv[2])
text = src.read_text()
if 'text = "session"' not in text:
    raise SystemExit("ORIGIN binding missing in config.capnp")
dest.write_text(text.replace('text = "session"', 'text = "macbook"', 1))
PY
[[ -f "$FOG/workerd-config/config.capnp" ]] || die "workerd-config write failed"
grep -q 'text = "macbook"' "$FOG/workerd-config/config.capnp" || die "ORIGIN not macbook"

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

say "7/9 tunnel token (hidden, local file only)"
TOKFILE="$SECRETS/tunnel.token"
if [[ ! -s "$TOKFILE" ]]; then
  TOK=$(osascript -e 'Tell application "System Events" to display dialog "Paste the Cloudflare named-tunnel token (hidden). Not stored in git." default answer "" with hidden answer' -e 'text returned of result' 2>/dev/null || true)
  [[ -n "${TOK:-}" ]] || die "token required once — save at $TOKFILE"
  printf "%s" "$TOK" > "$TOKFILE"
fi
chmod 600 "$TOKFILE"

say "8/9 LaunchAgents — fog KeepAlive (owns workerd via plugin). Tunnel HOLD."
cat > "$LAUNCH/pt.calhegasmorais.fog.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>pt.calhegasmorais.fog</string>
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
    <key>FOG_ORIGIN</key><string>macbook</string>
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

launchctl unload "$LAUNCH/pt.calhegasmorais.fog.plist" 2>/dev/null || true
launchctl unload "$LAUNCH/pt.calhegasmorais.workerd.plist" 2>/dev/null || true
launchctl unload "$LAUNCH/pt.calhegasmorais.tunnel.plist" 2>/dev/null || true
launchctl load "$LAUNCH/pt.calhegasmorais.fog.plist"
cp -f "$FOG/repo/deploy/mac-fog/fog-tui.py" "$FOG/bin/fog-tui.py"
chmod 755 "$FOG/bin/fog-tui.py" "$FOG/repo/deploy/mac-fog/FogRuntime.command" 2>/dev/null || true
echo
echo "This Mac’s loopback: workerd :8788 → fog :8787 (FOG_ORIGIN=macbook)."
echo "Public fog.calhegasmorais.pt rides macbook-server. HOLD fog-lab tunnel plist."
echo "Runtime UI: $FOG/bin/fog-tui.py  (q quit · s stop fog · 15s refresh)"

say "9/9 health"
sleep 3
curl -sf -m 5 http://127.0.0.1:8787/health && echo "  fog :8787 ok" || echo "  fog starting…"
curl -sf -m 5 http://127.0.0.1:8788/workerd && echo "  workerd :8788 ok" || echo "  workerd starting (fog plugin)…"
echo
echo "Layer: workerd :8788 → fog :8787  (public via macbook-server)"
echo "Stop fog:  $(dirname "$0")/stop-fog.command   or  s  in the runtime UI"
echo "LAB n=1  mesh_member=false  v5"
export FOG_HOME="$FOG"
osascript <<APP >/dev/null 2>&1 || true
tell application "Terminal"
  activate
  do script "export FOG_HOME='$FOG'; exec python3 '$FOG/bin/fog-tui.py'"
end tell
APP
open "$FOG/log" >/dev/null 2>&1 || true
