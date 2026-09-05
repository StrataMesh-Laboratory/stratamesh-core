#!/bin/bash
# Show desk-mail.token status on THIS Mac. Never paste output into chat if it prints a preview you consider sensitive.
# Usage: bash deploy/mac-fog/desk-token-show.sh [--reveal]
set -euo pipefail
CANDIDATES=(
  "$HOME/.config/stratagrok/desk-mail.token"
  "$HOME/.config/stratamesh/desk-mail.token"
  "${FOG_HOME:-$HOME/StrataMesh/fog}/data/secrets/desk-mail.token"
  "${FOG_HOME:-$HOME/StrataMesh/fog}/data/desk-mail.token"
)
REVEAL=0
[[ "${1:-}" == "--reveal" ]] && REVEAL=1

echo "desk-mail.token probe (local only)"
found=""
for p in "${CANDIDATES[@]}"; do
  if [[ -f "$p" ]]; then
    sz=$(wc -c < "$p" | tr -d ' ')
    echo "path: $p"
    echo "bytes: $sz"
    if [[ "$sz" -eq 0 ]]; then
      echo "status: empty"
    else
      # first line length only by default
      line=$(head -1 "$p" | tr -d '\r\n')
      echo "status: present"
      echo "len: ${#line}"
      if [[ "$REVEAL" -eq 1 ]]; then
        echo "value: $line"
      else
        # redacted: first 4 + last 4 if long enough
        if [[ ${#line} -ge 12 ]]; then
          echo "redacted: ${line:0:4}…${line: -4}"
        else
          echo "redacted: (too short to redact — use --reveal locally only)"
        fi
      fi
    fi
    found=1
    break
  else
    echo "missing: $p"
  fi
done
if [[ -z "$found" ]]; then
  echo "status: missing (no candidate file)"
  echo "write one line (no quotes) then chmod 600:"
  echo "  printf '%s\\n' 'YOUR_TOKEN' > ~/.config/stratagrok/desk-mail.token && chmod 600 ~/.config/stratagrok/desk-mail.token"
fi
# Also run desk_sync token-check if repo present
REPO="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
if [[ -f "$REPO/ops/desk-collegium/desk_sync.py" ]]; then
  echo "--- desk_sync token-check ---"
  (cd "$REPO" && python3 ops/desk-collegium/desk_sync.py token-check) || true
fi
