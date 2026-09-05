#!/bin/bash
# StrataMesh Fog auto-update. LaunchAgent StartInterval 1800, RunAtLoad true.
# Any hop /health is enough. Never tunnel/cloudflared. Never origin-take.
# brew update then brew upgrade (non-fatal). Never brew upgrade --greedy. Never brew uninstall.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

FOG="${FOG_HOME:-${STRATAMESH_HOME:-$HOME/StrataMesh}/fog}"
REPO="$FOG/repo"
LOG="$FOG/log/auto-update.log"
LOCK="$FOG/log/auto-update.lock"
ORIGIN="${FOG_ORIGIN:-macbook}"
MANUAL="$HOME/.config/stratamesh/last-manual-g"
INTERVAL=1800
HOP_PORTS="8787 8788 8790 8791 8792"

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

# Desk vault self-heal (non-fatal): KeePass or Tailscale pull — never blocks auto-g
if [[ -x "$REPO/deploy/mac-fog/ensure-desk-vault.sh" ]]; then
  set +e
  "$REPO/deploy/mac-fog/ensure-desk-vault.sh" >>"$LOG" 2>&1
  ev=$?
  set -e
  log "ensure-desk-vault rc=$ev"
elif [[ -x "$FOG/repo/deploy/mac-fog/ensure-desk-vault.sh" ]]; then
  set +e
  "$FOG/repo/deploy/mac-fog/ensure-desk-vault.sh" >>"$LOG" 2>&1
  ev=$?
  set -e
  log "ensure-desk-vault rc=$ev"
fi

hop_up() {
  local p
  for p in $HOP_PORTS; do
    if curl -sf -m 2 "http://127.0.0.1:${p}/health" >/dev/null; then
      return 0
    fi
  done
  return 1
}

# Interactive g and auto-g both brew (update then upgrade) before hop_up.
# Hops down is not a reason to omit brew; brew still runs first, then runtime-down may exit.
# CLT / Xcode-alone brew failures must not recycle_mw / kickstart-kill healthy hops.
BREW_CLT_MISS=0
BREW_BOTTLE_MISS=0
brew_clt_miss() {
  printf '%s' "$1" | grep -qiE 'Xcode alone is not sufficient|xcode-select|Command Line Tools'
}
brew_bottle_miss() {
  printf '%s' "$1" | grep -qiE 'no bottle available|no bottles available|bottle missing|Failed to download.*bottle|cannot install.*bottle'
}
run_brew_verb() {
  local verb="$1" out rc=0
  set +e
  out=$(brew "$verb" 2>&1)
  rc=$?
  set -e
  printf '%s\n' "$out" >>"$LOG"
  if brew_clt_miss "$out"; then
    BREW_CLT_MISS=1
    log "brew $verb clt-miss rc=$rc — skip recycle/kickstart this run"
  elif brew_bottle_miss "$out"; then
    BREW_BOTTLE_MISS=1
    log "brew $verb bottle-miss rc=$rc — skip source reinstall/recycle this run"
  elif [[ "$rc" -ne 0 ]]; then
    log "brew $verb rc=$rc"
  fi
}
# Prefer official Node (nodejs.org) over broken brew Cellar bottles.
NODE_BIN=""
if [[ -x "$FOG/bin/node-official" ]]; then
  NODE_BIN="$FOG/bin/node-official"
elif [[ -n "${FOG_HOME:-}" && -x "$FOG_HOME/bin/node-official" ]]; then
  NODE_BIN="$FOG_HOME/bin/node-official"
elif [[ -x "$HOME/StrataMesh/fog/bin/node-official" ]]; then
  NODE_BIN="$HOME/StrataMesh/fog/bin/node-official"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi
if command -v brew >/dev/null 2>&1; then
  run_brew_verb update
  run_brew_verb upgrade
  # Intel /usr/local and Apple Silicon /opt/homebrew are already on PATH.
  node_out=""
  node_rc=1
  if [[ -n "$NODE_BIN" ]]; then
    set +e
    node_out=$("$NODE_BIN" -v 2>&1)
    node_rc=$?
    set -e
  fi
  case "$node_out" in
    *[Dd]yld*|*libllhttp*|*[Aa]bort*|*Library\ not\ loaded*) node_rc=1 ;;
  esac
  if [[ -n "$NODE_BIN" && "$NODE_BIN" == *node-official* && "$node_rc" -eq 0 ]]; then
    log "node-official ok $($NODE_BIN -v 2>/dev/null | head -1)"
  elif [[ "$node_rc" -ne 0 ]]; then
    if [[ -n "$NODE_BIN" && "$NODE_BIN" == *node-official* ]]; then
      log "node-official broken — skip brew reinstall; runtime_mesh will surface last_error"
    elif [[ "$BREW_CLT_MISS" -eq 1 ]]; then
      log "skip brew reinstall (CLT miss)"
    elif [[ "$BREW_BOTTLE_MISS" -eq 1 ]]; then
      log "skip brew reinstall (bottle miss)"
    else
      set +e
      re_out=$(brew reinstall llhttp ada-url node 2>&1)
      re_rc=$?
      set -e
      printf '%s\n' "$re_out" >>"$LOG"
      if brew_clt_miss "$re_out"; then
        BREW_CLT_MISS=1
        log "brew reinstall clt-miss rc=$re_rc — skip recycle/kickstart this run"
      elif brew_bottle_miss "$re_out"; then
        BREW_BOTTLE_MISS=1
        log "brew reinstall bottle-miss rc=$re_rc — skip source thrash/recycle this run"
      elif [[ "$re_rc" -ne 0 ]]; then
        log "brew reinstall llhttp ada-url node rc=$re_rc"
      fi
    fi
  fi
  # Sequoia: Xcode.app alone cannot brew-build. Node 25.x looks for
  # libllhttp.9.3.dylib while Cellar may only have 9.4.x. Alias until CLT+reinstall.
  src=""
  for d in /usr/local/opt/llhttp/lib /opt/homebrew/opt/llhttp/lib; do
    [[ -e "$d/libllhttp.dylib" ]] && src="$d/libllhttp.dylib"
    [[ -z "$src" ]] && src=$(ls "$d"/libllhttp.*.dylib 2>/dev/null | grep -v '9\.3' | tail -1 || true)
    [[ -n "$src" ]] && break
  done
  if [[ -z "$src" ]]; then
    src=$(ls /usr/local/Cellar/llhttp/*/lib/libllhttp*.dylib /opt/homebrew/Cellar/llhttp/*/lib/libllhttp*.dylib 2>/dev/null | grep -v '9\.3' | tail -1 || true)
  fi
  if [[ -n "$src" ]]; then
    for d in /usr/local/opt/llhttp/lib /opt/homebrew/opt/llhttp/lib; do
      mkdir -p "$d"
      if [[ ! -e "$d/libllhttp.9.3.dylib" ]]; then
        ln -sf "$src" "$d/libllhttp.9.3.dylib" && log "linked $src -> $d/libllhttp.9.3.dylib"
      fi
    done
  else
    log "llhttp dylib missing (opt+Cellar)"
  fi
  # Walk every dyld miss (ada-url libada.3, next bottle, …).
  i=0
  while (( i < 8 )); do
    i=$((i + 1))
    if [[ -n "$NODE_BIN" && "$NODE_BIN" == *node-official* ]]; then
      node_out=$("$NODE_BIN" -v 2>&1) && break
      log "node-official still failing — stop dyld alias loop"
      break
    fi
    node_out=$(node -v 2>&1) && break
    miss=$(printf '%s\n' "$node_out" | sed -n 's/.*Library not loaded: //p' | awk '{print $1}' | head -1)
    [[ -z "$miss" ]] && break
    formula=$(printf '%s\n' "$miss" | awk -F/ '{for(i=1;i<=NF;i++) if($i=="opt"){print $(i+1); exit}}')
    base=$(basename "$miss")
    stem=${base%%.*}
    src=$(ls /usr/local/opt/"$formula"/lib/"$stem".dylib /opt/homebrew/opt/"$formula"/lib/"$stem".dylib \
             /usr/local/Cellar/"$formula"/*/lib/"$stem"*.dylib /opt/homebrew/Cellar/"$formula"/*/lib/"$stem"*.dylib \
             2>/dev/null | grep -v "$base" | tail -1 || true)
    [[ -z "$src" ]] && { log "no source for $miss"; break; }
    dest_dir=/usr/local/opt/"$formula"/lib
    mkdir -p "$dest_dir"
    ln -sf "$src" "$dest_dir/$base" && log "linked $src -> $dest_dir/$base"
  done
else
  log "brew missing"
fi

if ! hop_up; then
  log "skip runtime-down (brew already ran)"
  exit 0
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
  # brew may have just repaired dyld/libllhttp; :8791 stays dark until fog_mw.js respawns.
  if ! curl -sf -m 2 "http://127.0.0.1:8791/health" >/dev/null; then
    if [[ "$BREW_CLT_MISS" -eq 1 || "$BREW_BOTTLE_MISS" -eq 1 ]]; then
      if [[ "$BREW_CLT_MISS" -eq 1 ]]; then
        log "node :8791 dark + CLT miss — heal_node_dyld only; skip recycle_mw/kickstart"
      else
        log "node :8791 dark + bottle miss — heal_node_dyld only; skip recycle_mw/kickstart"
      fi
      PYTHONPATH="$REPO/src" python3 -c 'from fog_plugins.runtime_mesh import heal_node_dyld; print(heal_node_dyld())' >>"$LOG" 2>&1 || true
    else
      log "node :8791 dark after brew — heal dyld + recycle 8791 + kickstart fog (no tunnel)"
      PYTHONPATH="$REPO/src" python3 -c 'from fog_plugins.runtime_mesh import heal_node_dyld, recycle_mw; print(heal_node_dyld()); print(recycle_mw((8791,)))' >>"$LOG" 2>&1 || true
      UIDN=$(id -u)
      launchctl kickstart -k "gui/${UIDN}/pt.calhegasmorais.fog" >/dev/null 2>&1 || true
    fi
  fi
  exit 0
fi

if [[ -f "$MANUAL" ]]; then
  now=$(date +%s)
  mt=$(stat -f %m "$MANUAL" 2>/dev/null || stat -c %Y "$MANUAL" 2>/dev/null || echo 0)
  age=$((now - mt))
  node_dark=0
  curl -sf -m 2 "http://127.0.0.1:8791/health" >/dev/null || node_dark=1
  if (( age < INTERVAL )) && [[ "$node_dark" -eq 0 ]]; then
    log "skip last-manual-g age=${age}s < ${INTERVAL}s"
    exit 0
  fi
  if (( age < INTERVAL )) && [[ "$node_dark" -eq 1 ]]; then
    log "last-manual-g age=${age}s but :8791 dark — pull anyway"
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

if [[ -f "$REPO/ops/workerd/worker.js" ]]; then
  cp -f "$REPO/ops/workerd/worker.js" "$FOG/workerd-config/worker.js" || log "workerd worker.js copy skip"
else
  log "skip workerd worker.js missing"
fi
if [[ -f "$REPO/ops/workerd/config.capnp" ]]; then
  python3 - "$REPO/ops/workerd/config.capnp" "$FOG/workerd-config/config.capnp" "$ORIGIN" <<'PY' || log "capnp origin skip"
import sys
from pathlib import Path
src, dest, origin = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
if not src.is_file():
    raise SystemExit(0)
text = src.read_text()
for old in ("session", "macbook", "local", "edge"):
    needle = 'text = "%s"' % old
    if needle in text:
        text = text.replace(needle, 'text = "%s"' % origin, 1)
        break
dest.write_text(text)
PY
else
  log "skip capnp missing"
fi

if [[ -d /tmp/sm-core/ops/workerd ]]; then
  [[ -f "$FOG/workerd-config/worker.js" ]] && cp -f "$FOG/workerd-config/worker.js" /tmp/sm-core/ops/workerd/worker.js || true
  [[ -f "$FOG/workerd-config/config.capnp" ]] && cp -f "$FOG/workerd-config/config.capnp" /tmp/sm-core/ops/workerd/config.capnp || true
  log "copied workerd-config -> /tmp/sm-core/ops/workerd"
fi

healed=$(PYTHONPATH="$REPO/src" python3 -c 'from fog_plugins.runtime_mesh import heal_node_dyld; print(heal_node_dyld())' 2>/dev/null || echo heal-skip)
log "heal_node_dyld $healed"
if [[ "$BREW_CLT_MISS" -eq 1 || "$BREW_BOTTLE_MISS" -eq 1 ]]; then
  if [[ "$BREW_CLT_MISS" -eq 1 ]]; then
    log "CLT miss — skip recycle_mw / hop kills / kickstart (healthy python/fog/workerd kept)"
  else
    log "bottle miss — skip recycle_mw / hop kills / kickstart (healthy python/fog/workerd kept)"
  fi
else
  killed=$(PYTHONPATH="$REPO/src" python3 -c 'from fog_plugins.runtime_mesh import recycle_mw; print(recycle_mw((8787,8788,8790,8791,8792)))' 2>/dev/null || echo skip)
  log "recycle_mw $killed"

  UIDN=$(id -u)
  # NEVER tunnel / cloudflared
  launchctl kickstart -k "gui/${UIDN}/pt.calhegasmorais.fog" >/dev/null 2>&1 || true
  launchctl kickstart -k "gui/${UIDN}/pt.calhegasmorais.workerd" >/dev/null 2>&1 || true
  log "kickstart fog+workerd done (no tunnel)"
fi

# ollama wizard
command -v ollama >/dev/null 2>&1 && curl -sf --max-time 1 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || { ollama serve >/dev/null 2>&1 & true; }
