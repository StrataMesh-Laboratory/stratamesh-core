#!/bin/bash
# Real OpenClaw desk probe — meters + optional bus commit.
# Usage: bash deploy/mac-fog/desk-claw-probe.sh [done]
# Public hops need a browser-like User-Agent (CF blocks bare urllib/python UA → 403).
set -euo pipefail
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
REPO="${FOG_SRC:-$FOG/repo}"
mkdir -p "$FOG/data/desk-meters" "$FOG/data"
USED="${OPENCLAW_TOKENS_USED:-}"
LIM="${OPENCLAW_TOKENS_LIMIT:-33000}"
MODEL="${OPENCLAW_MODEL:-ollama/qwen2.5:3b-desk8k}"
UA="${OPENCLAW_PROBE_UA:-Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36}"
if [[ -z "$USED" && -f "$FOG/data/desk-meters/openclaw.json" ]]; then
  USED=$(python3 -c "import json;print(json.load(open('$FOG/data/desk-meters/openclaw.json')).get('tokens_used',2100))" 2>/dev/null || echo 2100)
fi
USED="${USED:-2100}"
TS=$(date +%Y-%m-%dT%H:%M:%S%z)
ok8787=0; curl -sf -m 2 http://127.0.0.1:8787/health >/dev/null && ok8787=1 || true
ok8788=0; curl -sf -m 2 http://127.0.0.1:8788/health >/dev/null && ok8788=1 || true
ok18789=0
curl -sf -m 2 http://127.0.0.1:18789/ >/dev/null 2>&1 && ok18789=1 || true
fog_public=0; curl -sf -m 10 -A "$UA" https://fog.calhegasmorais.pt/health >/dev/null && fog_public=1 || true
edge_api=0; curl -sf -m 10 -A "$UA" https://api-edge.calhegasmorais.pt/health >/dev/null && edge_api=1 || true
# ok only when PENDING schema hops all up
ok=0
if [[ "$fog_public" == 1 && "$edge_api" == 1 && "$ok8787" == 1 ]]; then ok=1; fi
python3 - << PY
import json
from pathlib import Path
p = Path("$FOG/data/desk-meters/openclaw.json")
p.write_text(json.dumps({
  "tokens_used": int("$USED"),
  "tokens_limit": int("$LIM"),
  "model": "$MODEL",
  "ts": "$TS",
  "fog_public": int("$fog_public"),
  "edge_api": int("$edge_api"),
  "local_8787": int("$ok8787"),
  "ok": bool(int("$ok")),
  "probes": {
    "fog_8787": int("$ok8787"),
    "workerd_8788": int("$ok8788"),
    "openclaw_18789": int("$ok18789"),
    "fog_public": int("$fog_public"),
    "edge_api": int("$edge_api"),
    "local_8787": int("$ok8787"),
  },
  "method": "curl+browser-UA",
}, indent=2) + chr(10))
print(p)
PY
MSG="claw probe local=$ok8787 workerd=$ok8788 ws=$ok18789 fog_public=$fog_public edge_api=$edge_api ok=$ok tokens=${USED}/${LIM}"
python3 "$REPO/ops/desk-collegium/desk_metabol.py" tick >/dev/null || true
echo "$MSG"
# also log
echo "$MSG" > "$FOG/data/desk-meters/openclaw-last.log"
if [[ "${1:-}" == "done" ]]; then
  python3 "$REPO/ops/desk-collegium/desk_bus.py" done dt-proj-m1-claw-loop --by openclaw --result "$MSG" || true
fi
