#!/bin/bash
# Real OpenClaw desk probe — meters + feed + optional bus commit.
# Usage: bash deploy/mac-fog/openclaw/desk-claw-probe.sh [done]
set -euo pipefail
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
REPO="${FOG_SRC:-$FOG/repo}"
mkdir -p "$FOG/data/desk-meters" "$FOG/data"
USED="${OPENCLAW_TOKENS_USED:-}"
LIM="${OPENCLAW_TOKENS_LIMIT:-33000}"
MODEL="${OPENCLAW_MODEL:-ollama/qwen2.5:3b-desk8k}"
# Prefer live sample file if agent wrote one
if [[ -z "$USED" && -f "$FOG/data/desk-meters/openclaw.json" ]]; then
  USED=$(python3 -c "import json;print(json.load(open('$FOG/data/desk-meters/openclaw.json')).get('tokens_used',2100))" 2>/dev/null || echo 2100)
fi
USED="${USED:-2100}"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ok8787=0; curl -sf -m 2 http://127.0.0.1:8787/health >/dev/null && ok8787=1 || true
ok8788=0; curl -sf -m 2 http://127.0.0.1:8788/health >/dev/null && ok8788=1 || true
ok18789=0
# Prefer curl HTTP — nc -z can miss a healthy loopback listener on some macOS builds.
curl -sf -m 2 http://127.0.0.1:18789/ >/dev/null 2>&1 && ok18789=1 || true
python3 - << PY
import json
from pathlib import Path
p = Path("$FOG/data/desk-meters/openclaw.json")
p.write_text(json.dumps({
  "tokens_used": int("$USED"),
  "tokens_limit": int("$LIM"),
  "model": "$MODEL",
  "ts": "$TS",
  "probes": {"fog_8787": int("$ok8787"), "workerd_8788": int("$ok8788"), "openclaw_18789": int("$ok18789")},
}, indent=2) + chr(10))
print(p)
PY
# Reality: hop curls update meters only — NEVER openclaw feed byline (Mac curl theatre).
# openclaw byline only after real `openclaw agent exec` evidence (desk_ops.handler_claw).
MSG="claw probe fog=$ok8787 workerd=$ok8788 ws=$ok18789 tokens=${USED}/${LIM} (meters-only)"
python3 "$REPO/ops/desk-collegium/desk_metabol.py" tick >/dev/null || true
echo "$MSG"
if [[ "${1:-}" == "done" ]]; then
  python3 "$REPO/ops/desk-collegium/desk_bus.py" done dt-d08d38cb --by openclaw --result "$MSG" || true
fi
