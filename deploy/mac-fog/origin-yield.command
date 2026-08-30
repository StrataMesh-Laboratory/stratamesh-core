#!/bin/bash
# Optional: Mac stays primary. Session persist auto-yields when macbook-server
# is healthy. This file only records a local lease. Do not pkill cloudflared
# (macbook-server must stay up).
set -euo pipefail
LEASE="$HOME/.config/stratamesh/origin.lease"
mkdir -p "$(dirname "$LEASE")"
printf '{"role":"macbook","public":true,"primary":true,"updated":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LEASE"
echo "Mac remains primary (macbook-server). Do not unload that tunnel."
echo "Session standby: python3 ops/bin/fog-persist.py --daemon"
echo "If session held fallback: origin-take.command (reclaim) or wait for auto-yield."
