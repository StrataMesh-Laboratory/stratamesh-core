#!/usr/bin/env bash
# Mac-local academy daily exam tick — NO Bot / grok.com dependency.
set -euo pipefail
export FOG_SRC="${FOG_SRC:-$HOME/StrataMesh/fog/repo}"
export FOG_HOME="${FOG_HOME:-$HOME/StrataMesh/fog}"
cd "$FOG_SRC"
DAY="$(python3 - <<'PY'
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
    print(datetime.now(ZoneInfo("Europe/Lisbon")).strftime("%Y-%m-%d"))
except Exception:
    from datetime import timezone, timedelta
    print((datetime.now(timezone.utc) + timedelta(hours=1)).strftime("%Y-%m-%d"))
PY
)"
OUT="$FOG_SRC/academy_scores/$DAY"
if [[ -f "$OUT/scores.json" ]]; then
  echo "academy-exams-tick: already scored $DAY"
  exit 0
fi
EX="$FOG_SRC/ops/desk-collegium/academy_exams.py"
if [[ -f "$EX" ]]; then
  python3 "$EX" --tick --day "$DAY"
else
  echo "academy-exams-tick: academy_exams.py missing" >&2
  exit 1
fi
