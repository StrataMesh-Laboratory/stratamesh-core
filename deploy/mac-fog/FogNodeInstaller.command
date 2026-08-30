#!/bin/bash
# StrataMesh Fog Mac installer v3 — workerd layer + named tunnel
# Double-click in Finder. No secrets in this file.
# One origin at a time for fog.calhegasmorais.pt (stop the Grok-session persist first).
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

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

osascript -e 'display notification "StrataMesh Fog v3" with title "Installer"' >/dev/null 2>&1 || true

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
    stub=$("$c" -c 'import sys; print("/Library/Developer/CommandLineTools" in (sys.base_prefix+sys.prefix))' 2>/dev/null || echo 0)
    case "$v" in 3.1[1-9]|3.[2-9]*) PY=$c; break ;; esac
  fi
done
if [[ -z "$PY" ]]; then
  if command -v brew >/dev/null 2>&1; then
    brew install python@3.12
    PY=$(command -v python3.12 || command -v python3)
  else
    die "install Python 3.11+ from python.org or brew, then re-run"
  fi
fi
echo "python=$PY $($PY --version)"

say "3/9 clone/pull stratamesh-core"
if [[ -d "$FOG/repo/.git" ]]; then
  git -C "$FOG/repo" pull --ff-only || true
else
  git clone --depth 1 "$REPO" "$FOG/repo"
fi
# fog runtime is src + ops/workerd
ln -sfn "$FOG/repo/src" "$SRC"
ln -sfn "$FOG/repo/ops/workerd" "$FOG/workerd-config"

say "4/9 venv + psutil"
"$PY" -m venv "$FOG/venv"
"$FOG/venv/bin/pip" install -q --upgrade pip
"$FOG/venv/bin/pip" install -q psutil || true

say "5/9 workerd (OSS runtime on :8788)"
if command -v npm >/dev/null 2>&1; then
  npm install --prefix "$FOG/workerd-runtime" workerd --no-fund --no-audit
else
  die "need node/npm (brew install node) for workerd"
fi
WD="$FOG/workerd-runtime/node_modules/.bin/workerd"
[[ -x "$WD" ]] || die "workerd binary missing"
"$WD" --version || true

say "6/9 cloudflared $CF_VER"
if [[ "$ARCH" == "arm64" ]]; then CF_ARCH=arm64; else CF_ARCH=amd64; fi
CF_URL="https://github.com/cloudflare/cloudflared/releases/download/${CF_VER}/cloudflared-darwin-${CF_ARCH}.tgz"
curl -fsSL "$CF_URL" -o /tmp/cf.tgz
tar -xzf /tmp/cf.tgz -C "$FOG/bin"
mv -f "$FOG/bin/cloudflared" "$FOG/bin/cloudflared" 2>/dev/null || true
# tarball may drop binary in cwd name
find "$FOG/bin" /tmp -name 'cloudflared' -type f 2>/dev/null | head -1 | while read -r f; do
  cp -f "$f" "$FOG/bin/cloudflared"
done
chmod 755 "$FOG/bin/cloudflared"
"$FOG/bin/cloudflared" --version || true

say "7/9 tunnel token (hidden, local file only)"
TOKFILE="$SECRETS/tunnel.token"
if [[ ! -s "$TOKFILE" ]]; then
  TOK=$(osascript -e 'Tell application "System Events" to display dialog "Paste the Cloudflare named-tunnel token (hidden). Not stored in git." default answer "" with hidden answer' -e 'text returned of result' 2>/dev/null || true)
  [[ -n "${TOK:-}" ]] || die "token required once — save at $TOKFILE"
  printf "%s" "$TOK" > "$TOKFILE"
fi
chmod 600 "$TOKFILE"

say "8/9 LaunchAgents (KeepAlive) fog :8787 · workerd :8788 · tunnel → :8788"
# fog
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
  </dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$FOG/log/fog.out</string>
  <key>StandardErrorPath</key><string>$FOG/log/fog.err</string>
</dict></plist>
EOF
# workerd (belt; fog plugin also reboots)
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
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$FOG/log/workerd.out</string>
  <key>StandardErrorPath</key><string>$FOG/log/workerd.err</string>
</dict></plist>
EOF
# tunnel wrapper (token via env, never argv)
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
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$FOG/log/tunnel.out</string>
  <key>StandardErrorPath</key><string>$FOG/log/tunnel.err</string>
</dict></plist>
EOF

launchctl unload "$LAUNCH/pt.calhegasmorais.fog.plist" 2>/dev/null || true
launchctl unload "$LAUNCH/pt.calhegasmorais.workerd.plist" 2>/dev/null || true
launchctl unload "$LAUNCH/pt.calhegasmorais.tunnel.plist" 2>/dev/null || true
launchctl load "$LAUNCH/pt.calhegasmorais.fog.plist"
launchctl load "$LAUNCH/pt.calhegasmorais.workerd.plist"
echo "HOLD tunnel load until this session's persist is stopped (one origin)."
echo "Then: launchctl load $LAUNCH/pt.calhegasmorais.tunnel.plist"

say "9/9 health"
sleep 2
curl -sf -m 5 http://127.0.0.1:8787/health && echo " fog :8787 ok" || echo " fog starting…"
curl -sf -m 5 http://127.0.0.1:8788/workerd && echo || echo " workerd starting…"
echo
echo "Layer: tunnel → workerd :8788 → fog :8787"
echo "Stop:  $(dirname "$0")/stop-fog.command"
echo "LAB n=1  mesh_member=false  v3"
open "$FOG/log" >/dev/null 2>&1 || true
