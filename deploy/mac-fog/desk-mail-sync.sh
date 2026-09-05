#!/usr/bin/env bash
# Sync automation.desk@ Worker inbox → shared Maildir.
# Mirrors grok-mail-sync pattern. No secrets printed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PY="${ROOT}/deploy/mac-fog/desk-mail-sync.py"
if [[ ! -f "$PY" ]]; then
  echo "desk-mail-sync: missing $PY" >&2
  exit 1
fi
exec python3 "$PY" "$@"
