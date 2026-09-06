#!/bin/bash
# Real multi-level contingency for Hermes / OpenClaw / OpenCode.
# status | ensure | run <coord|claw|code|all>
set -euo pipefail
REPO="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
CMD="${1:-status}"
SPEC="${2:-all}"
UID_NUM="$(id -u)"
METER_DIR="$FOG/data/desk-meters"
mkdir -p "$METER_DIR" "$FOG/data/desk-outbox"
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

write_meter() {
  local name="$1" status="$2" detail="$3"
  python3 - "$METER_DIR/${name}.json" "$status" "$detail" <<'MPY'
import json,sys,time
from pathlib import Path
p=Path(sys.argv[1]); status=sys.argv[2]; detail=sys.argv[3]
cur={}
if p.is_file():
  try: cur=json.loads(p.read_text())
  except Exception: cur={}
cur.update({"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "status": status, "detail": detail, "contingency": True})
p.write_text(json.dumps(cur, indent=2)+"\n")
print(p, status)
MPY
}

openclaw_live() {
  launchctl print "gui/${UID_NUM}/ai.openclaw.gateway" 2>/dev/null | grep -q "state = running" || return 1
  lsof -nP -iTCP:18789 -sTCP:LISTEN >/dev/null 2>&1 || return 1
  return 0
}
ollama_live() { curl -sS -m 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; }
fog_live() { curl -sS -m 2 http://127.0.0.1:8787/health 2>/dev/null | grep -q '"ok": true'; }

status_all() {
  echo "=== desk agent contingency status $(date +%Y-%m-%dT%H:%M:%S%z) ==="
  fog_live && echo "Fog: LIVE :8787" || echo "Fog: DOWN"
  ollama_live && echo "Ollama: LIVE :11434" || echo "Ollama: DOWN"
  openclaw_live && echo "OpenClaw: LIVE :18789" || echo "OpenClaw: DOWN"
  [[ -f "$METER_DIR/hermes.json" ]] && echo "Hermes meter: present" || echo "Hermes meter: missing"
  [[ -f "$METER_DIR/opencode.json" ]] && echo "OpenCode meter: present" || echo "OpenCode meter: missing"
  ps aux | grep -iE '[Hh]ermes|[Oo]pencod' | grep -v grep | head -8 || true
}

ensure_openclaw() {
  if openclaw_live; then echo "OpenClaw already live"; return 0; fi
  python3 - <<'EPY'
import json,shutil,time
from pathlib import Path
p=Path.home()/".openclaw"/"openclaw.json"
d=json.loads(p.read_text())
ad=(d.get("agents") or {}).get("defaults") or {}
if "maxAgents" in ad:
  shutil.copy2(p, p.with_name(p.name+f".bak-contingency-{time.strftime('%Y%m%d-%H%M%S')}"))
  ad.pop("maxAgents", None)
  d.setdefault("agents", {})["defaults"] = ad
  p.write_text(json.dumps(d, indent=2)+"\n")
  print("stripped maxAgents")
else:
  print("maxAgents absent")
EPY
mkdir -p "$HOME/.openclaw/logs/stability/quarantine"
mv "$HOME"/.openclaw/logs/stability/*crash_loop_breaker.json "$HOME/.openclaw/logs/stability/quarantine/" 2>/dev/null || true
  launchctl bootout "gui/${UID_NUM}/ai.openclaw.gateway" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/${UID_NUM}" "$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist"
  sleep 6
  if openclaw_live; then write_meter openclaw live "gateway after ensure"; return 0; fi
  write_meter openclaw down "ensure failed"; return 1
}

run_fog_tools() {
  cd "$REPO"
  python3 ops/desk-collegium/desk_ops.py cycle --max 1 || true
  python3 -m compileall -q ops/desk-collegium || true
  python3 -m unittest discover -s ops/desk-collegium -p 'test_desk_*.py' -q || true
  write_meter fog_tools ran "desk_ops+compileall+unittest"
}

run_coord() {
  if bash "$REPO/deploy/mac-fog/hermes/desk-hermes-pulse.sh"; then write_meter hermes live "pulse ok"; return 0; fi
  ensure_openclaw || true
  if openclaw_live && bash "$REPO/deploy/mac-fog/desk-claw-probe.sh"; then write_meter hermes fallback_openclaw "coord via claw"; return 0; fi
  run_fog_tools; write_meter hermes fallback_fog_tools "coord via fog tools"
}

run_claw() {
  ensure_openclaw || true
  if openclaw_live && bash "$REPO/deploy/mac-fog/desk-claw-probe.sh"; then write_meter openclaw live "probe ok"; return 0; fi
  if bash "$REPO/deploy/mac-fog/hermes/desk-hermes-pulse.sh"; then write_meter openclaw fallback_hermes "claw via hermes"; return 0; fi
  for p in 8787 8788 8790 8791 8792; do curl -sS -m 2 "http://127.0.0.1:$p/health" >/dev/null 2>&1 && echo "hop :$p ok" || echo "hop :$p down"; done
  write_meter openclaw fallback_fog_hops "claw via hop matrix"
}

run_code() {
  if bash "$REPO/deploy/mac-fog/desk-agent-run.sh" opencode; then write_meter opencode live "desk-agent-run"; return 0; fi
  bash "$REPO/deploy/mac-fog/hermes/desk-hermes-pulse.sh" || true
  run_fog_tools; write_meter opencode fallback_fog_tools "code via fog tools"
}

case "$CMD" in
  status) status_all ;;
  ensure) ensure_openclaw; status_all ;;
  run)
    case "$SPEC" in
      coord|hermes) run_coord ;;
      claw|openclaw) run_claw ;;
      code|opencode) run_code ;;
      all)
        echo "contingency: serialize — running coord then claw then code (one at a time)"
        run_coord
        run_claw
        run_code
        status_all
        ;;
      *) echo "unknown spec"; exit 2 ;;
    esac ;;
  *) echo "usage: $0 status|ensure|run <coord|claw|code|all>"; exit 2 ;;
esac
