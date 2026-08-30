#!/bin/bash
# Mac drops the named-tunnel origin. Fog + workerd stay on this Mac’s loopback.
# Session may then: python3 ops/bin/fog-persist.py --resume-public
set -euo pipefail
LAUNCH="$HOME/Library/LaunchAgents/pt.calhegasmorais.tunnel.plist"
LEASE="$HOME/.config/stratamesh/origin.lease"
launchctl unload "$LAUNCH" 2>/dev/null || true
mkdir -p "$(dirname "$LEASE")"
printf '{"role":"macbook","public":false,"yielded_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LEASE"
echo "Mac yielded public origin. Local :8788/:8787 still up."
echo "Session resume: python3 ops/bin/fog-persist.py --resume-public"
