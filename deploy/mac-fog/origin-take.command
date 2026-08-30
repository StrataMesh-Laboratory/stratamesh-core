#!/bin/bash
# Mac is primary via macbook-server (already running). This asks the
# session fallback to flip DNS fog → macbook-server, then waits.
# Does not use the Grok-session :8788. This Mac’s :8788 only.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PUBLIC="${FOG_PUBLIC_URL:-https://fog.calhegasmorais.pt/health}"
RECLAIM_URL="${FOG_RECLAIM_URL:-https://fog.calhegasmorais.pt/origin/reclaim}"
TOKFILE="${ORIGIN_TOKEN_FILE:-$HOME/.config/stratamesh/tunnel.token}"
LEASE="$HOME/.config/stratamesh/origin.lease"

die() { printf "FAIL: %s\n" "$*" >&2; exit 1; }

LOCAL=$(curl -sf -m 3 http://127.0.0.1:8788/health || true)
echo "$LOCAL" | grep -q '"origin":"macbook"' || die "local workerd is not macbook origin (is fog up?)"

CODE=$(curl -sS -m 8 -o /tmp/fog-origin.json -w "%{http_code}" -A "Mozilla/5.0" "$PUBLIC" || echo "000")
if [[ "$CODE" == "200" ]] && grep -q '"origin":"macbook"' /tmp/fog-origin.json 2>/dev/null; then
  mkdir -p "$(dirname "$LEASE")"
  printf '{"role":"macbook","public":true,"taken_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LEASE"
  echo "already public (macbook)"
  cat /tmp/fog-origin.json
  exit 0
fi

if [[ "$CODE" == "200" ]] && grep -q '"origin":"session"' /tmp/fog-origin.json 2>/dev/null; then
  [[ -s "$TOKFILE" ]] || die "session is public fallback. missing $TOKFILE for reclaim HMAC"
  TOK=$(tr -d '\n\r' < "$TOKFILE")
  SECRET=$(printf '%s' "${TOK}:origin-reclaim" | shasum -a 256 | awk '{print substr($1,1,32)}')
  echo "session fallback live — posting /origin/reclaim"
  curl -sS -m 8 -X POST "$RECLAIM_URL" \
    -H "Authorization: Bearer $SECRET" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0" \
    -d '{"role":"macbook"}' || true
  echo
  echo "waiting for DNS yield (session persist ≤15s + propagate)"
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    sleep 3
    BODY=$(curl -sf -m 8 -A "Mozilla/5.0" "$PUBLIC" || true)
    if echo "$BODY" | grep -q '"origin":"macbook"'; then
      mkdir -p "$(dirname "$LEASE")"
      printf '{"role":"macbook","public":true,"taken_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LEASE"
      echo "$BODY"
      echo "flux: macbook.live (reclaim)"
      exit 0
    fi
  done
  die "session still public after reclaim. On Grok host: python3 ops/bin/fog-persist.py --yield-public"
fi

echo "public DARK (code=$CODE). macbook-server should already be the DNS target."
echo "If session took fallback, wait 30s or run origin-take again once fog /health is session."
mkdir -p "$(dirname "$LEASE")"
printf '{"role":"macbook","public":true,"taken_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LEASE"
exit 0
