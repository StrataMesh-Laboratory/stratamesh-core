#!/bin/bash
# Mac takes the named-tunnel origin. Session must already have --yield-public.
# Does not use the Grok-session :8788. This Mac’s :8788 only.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PUBLIC="${FOG_PUBLIC_URL:-https://fog.calhegasmorais.pt/health}"
LAUNCH="$HOME/Library/LaunchAgents/pt.calhegasmorais.tunnel.plist"
LEASE="$HOME/.config/stratamesh/origin.lease"

die() { printf "FAIL: %s\n" "$*" >&2; exit 1; }
[[ -f "$LAUNCH" ]] || die "run FogNodeInstaller.command first"

LOCAL=$(curl -sf -m 3 http://127.0.0.1:8788/health || true)
echo "$LOCAL" | grep -q '"origin":"macbook"' || die "local workerd is not macbook origin (is fog up?)"

CODE=$(curl -sS -m 8 -o /tmp/fog-origin.json -w "%{http_code}" "$PUBLIC" || echo "000")
if [[ "$CODE" == "200" ]] && grep -q '"origin":"session"' /tmp/fog-origin.json 2>/dev/null; then
  die "session still public. On the Grok host: python3 ops/bin/fog-persist.py --yield-public"
fi
if [[ "$CODE" == "200" ]] && grep -q '"origin":"macbook"' /tmp/fog-origin.json 2>/dev/null; then
  echo "already public (macbook)"
  exit 0
fi

launchctl load "$LAUNCH"
mkdir -p "$(dirname "$LEASE")"
printf '{"role":"macbook","public":true,"taken_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LEASE"
echo "taken. waiting for public /health origin=macbook"
for i in 1 2 3 4 5 6 7 8; do
  sleep 2
  BODY=$(curl -sf -m 8 "$PUBLIC" || true)
  if echo "$BODY" | grep -q '"origin":"macbook"'; then
    echo "$BODY"
    echo "flux: macbook.live"
    exit 0
  fi
done
echo "tunnel loaded; public not yet origin=macbook (propagate). probe: $PUBLIC"
exit 0
