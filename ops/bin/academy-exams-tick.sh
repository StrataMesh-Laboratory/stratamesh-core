#!/usr/bin/env bash
# Mac-local academy daily exam tick — NO Bot / grok.com dependency.
set -euo pipefail
export FOG_SRC="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
export FOG_HOME="${FOG_HOME:-$HOME/StrataMesh/fog}"
cd "$FOG_SRC"
DAY="$(python3 -c 'from datetime import datetime, timezone, timedelta; print((datetime.now(timezone.utc)+timedelta(hours=1)).strftime("%Y-%m-%d"))')"
OUT="$FOG_SRC/academy_scores/$DAY"
if [[ -f "$OUT/scores.json" ]]; then
  echo "academy-exams-tick: already scored $DAY"
  exit 0
fi
if [[ -f "$FOG_SRC/ops/desk-collegium/academy_exams.py" ]]; then
  python3 "$FOG_SRC/ops/desk-collegium/academy_exams.py" --tick --day "$DAY"
else
  echo "academy-exams-tick: academy_exams.py not yet present — waiting for v0 land" >&2
  exit 0
fi
