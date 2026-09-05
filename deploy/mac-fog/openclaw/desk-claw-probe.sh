#!/bin/bash
# OpenClaw desk task helper — probe local hops, write meter, append desk-feed.
# Run when lane-openclaw is ALLOW. No secrets.
set -euo pipefail
FOG="${FOG_HOME:-$HOME/StrataMesh/fog}"
REPO="${FOG_SRC:-$FOG/repo}"
mkdir -p "$FOG/data/desk-meters" "$FOG/data"
# session tokens: optional override
USED="${OPENCLAW_TOKENS_USED:-2100}"
LIM="${OPENCLAW_TOKENS_LIMIT:-33000}"
MODEL="${OPENCLAW_MODEL:-llava:latest}"
printf '%s\n' "{\"tokens_used\":$USED,\"tokens_limit\":$LIM,\"model\":\"$MODEL\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
  > "$FOG/data/desk-meters/openclaw.json"
ok8787=0; curl -sf -m 2 http://127.0.0.1:8787/health >/dev/null && ok8787=1 || true
ok18789=0; curl -sf -m 2 http://127.0.0.1:18789/ >/dev/null && ok18789=1 || true
# ws may not answer HTTP — treat port open as weak ok
if ! command -v nc >/dev/null; then :; else
  nc -z 127.0.0.1 18789 2>/dev/null && ok18789=1 || true
fi
MSG="claw probe fog:8787=$ok8787 openclaw:18789=$ok18789 tokens=${USED}/${LIM}"
python3 "$REPO/deploy/mac-fog/desk-feed-append.py" openclaw "$MSG" --kind say --specialty claw || true
python3 "$REPO/ops/desk-collegium/desk_metabol.py" tick || true
echo "$MSG"
