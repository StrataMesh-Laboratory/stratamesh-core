#!/bin/bash
# StrataMesh Fog auto-update. LaunchAgent StartInterval 1800.
# Runtime must be up. Never tunnel/cloudflared. Never brew upgrade. Never origin-take.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

FOG="${FOG_HOME:-${STRATAMESH_HOME:-$HOME/StrataMesh}/fog}"
REPO="$FOG/repo"
LOG="$FOG/log/auto-update.log"
LOCK="$FOG/log/auto-update.lock"
ORIGIN="${FOG_ORIGIN:-macbook}"
MANUAL="$HOME/.config/stratamesh/last-manual-g"
INTERVAL=1800

mkdir -p "$FOG/log" "$FOG/bin" "$FOG/workerd-config"

if [[ -z "${_FOG_AU_LOCKED:-}" ]]; then
  export _FOG_AU_LOCKED=1
  python3 - "$LOCK" "$LOG" "$0" "$@" <<'PY'
import fcntl, os, sys, time
lock, log, script = sys.argv[1], sys.argv[2], sys.argv[3]
fd = os.open(lock, os.O_CREAT | os.O_RDWR, 0o644)
try:
    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    with open(log, "a") as f:
        f.write(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) + " skip lock held\n")
    raise SystemExit(0)
fcntl.fcntl(fd, fcntl.F_SETFD, 0)
os.execv("/bin/bash", ["/bin/bash", script, *sys.argv[4:]])
PY
  exit $?
fi

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"; }

if ! curl -sf -m 2 http://127.0.0.1:8788/health >/dev/null; then
  log "skip runtime-down"
  exit 0
fi

if command -v brew >/dev/null 2>&1; then
  brew update >>"$LOG" 2>&1 || log "brew update rc=$?"
else
  log "brew missing — skip brew update"
fi

if [[ ! -d "$REPO/.git" ]]; then
  log "skip no-repo"
  exit 0
fi

git -C "$REPO" fetch origin main >>"$LOG" 2>&1 || { log "fetch fail"; exit 0; }
HEAD=$(git -C "$REPO" rev-parse HEAD)
REMOTE=$(git -C "$REPO" rev-parse origin/main)
if [[ "$HEAD" == "$REMOTE" ]]; then
  log "ok already origin/main ${HEAD:0:12}"
  exit 0
fi

if [[ -f "$MANUAL" ]]; then
  now=$(date +%s)
  mt=$(stat -f %m "$MANUAL" 2>/dev/null || stat -c %Y "$MANUAL" 2>/dev/null || echo 0)
  age=$((now - mt))
  if (( age < INTERVAL )); then
    log "skip last-manual-g age=${age}s < ${INTERVAL}s"
    exit 0
  fi
fi

log "reset ${HEAD:0:12} -> ${REMOTE:0:12}"
git -C "$REPO" fetch origin main >>"$LOG" 2>&1 || true
git -C "$REPO" reset --hard origin/main >>"$LOG" 2>&1

cp -f "$REPO/deploy/mac-fog/fog-tui.py" "$FOG/bin/fog-tui.py" 2>/dev/null || true
if [[ -f "$REPO/deploy/mac-fog/FogRuntime.command" ]]; then
  cp -f "$REPO/deploy/mac-fog/FogRuntime.command" "$FOG/bin/FogRuntime.command"
  chmod 755 "$FOG/bin/FogRuntime.command" 2>/dev/null || true
fi
if [[ -f "$REPO/deploy/mac-fog/fog-auto-update.sh" ]]; then
  cp -f "$REPO/deploy/mac-fog/fog-auto-update.sh" "$FOG/bin/fog-auto-update.sh"
  chmod 755 "$FOG/bin/fog-auto-update.sh" 2>/dev/null || true
fi

cp -f "$REPO/ops/workerd/worker.js" "$FOG/workerd-config/worker.js"
python3 - "$REPO/ops/workerd/config.capnp" "$FOG/workerd-config/config.capnp" "$ORIGIN" <<'PY'
import sys
from pathlib import Path
src, dest, origin = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
text = src.read_text()
for old in ("session", "macbook", "local", "edge"):
    needle = 'text = "%s"' % old
    if needle in text:
        text = text.replace(needle, 'text = "%s"' % origin, 1)
        break
else:
    raise SystemExit("ORIGIN binding missing in config.capnp")
dest.write_text(text)
PY

if [[ -d /tmp/sm-core/ops/workerd ]]; then
  cp -f "$FOG/workerd-config/worker.js" /tmp/sm-core/ops/workerd/worker.js
  cp -f "$FOG/workerd-config/config.capnp" /tmp/sm-core/ops/workerd/config.capnp
  log "copied workerd-config -> /tmp/sm-core/ops/workerd"
fi

UIDN=$(id -u)
# NEVER tunnel / cloudflared
launchctl kickstart -k "gui/${UIDN}/pt.calhegasmorais.fog" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/${UIDN}/pt.calhegasmorais.workerd" >/dev/null 2>&1 || true
log "kickstart fog+workerd done (no tunnel)"
