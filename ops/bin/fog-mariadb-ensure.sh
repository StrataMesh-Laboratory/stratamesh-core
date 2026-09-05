#!/usr/bin/env bash
# Ensure local MariaDB fog_cmn schema for Fog exclusive-off DSN.
# Soft-fail if MariaDB/brew missing. Never print passwords.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SQL="$ROOT/fog_cmn.mariadb.sql"
CFG="${HOME}/.config/stratamesh"
HOST="${FOG_MYSQL_HOST:-127.0.0.1}"
PORT="${FOG_MYSQL_PORT:-3306}"
DB="${FOG_MYSQL_DB:-fog_cmn}"
USER="${FOG_MYSQL_USER:-grok}"

load_pw() {
  if [[ -n "${STAFF_GROK_PASSWORD:-}" ]]; then printf "%s" "$STAFF_GROK_PASSWORD"; return; fi
  for f in "$CFG/staff_grok.password" "$CFG/fog_mysql.password" "$HOME/.config/stratagrok/staff_grok.password"; do
    if [[ -f "$f" ]]; then tr -d "\n" < "$f"; return; fi
  done
  return 1
}

if ! command -v mysql >/dev/null 2>&1; then
  echo "fog-mariadb-ensure: mysql client missing (brew install mariadb) — soft-fail"
  exit 0
fi
if [[ ! -f "$SQL" ]]; then
  echo "fog-mariadb-ensure: missing $SQL — soft-fail"
  exit 0
fi
if ! PW="$(load_pw)"; then
  echo "fog-mariadb-ensure: no STAFF_GROK_PASSWORD / vault file — soft-fail"
  exit 0
fi
if ! MYSQL_PWD="$PW" mysql -h "$HOST" -P "$PORT" -u "$USER" -e "SELECT 1" "$DB" >/dev/null 2>&1; then
  echo "fog-mariadb-ensure: cannot connect ${USER}@${HOST}:${PORT}/${DB} — soft-fail (SQLite remains default)"
  exit 0
fi
MYSQL_PWD="$PW" mysql -h "$HOST" -P "$PORT" -u "$USER" "$DB" < "$SQL"
echo "fog-mariadb-ensure: schema applied ok db=$DB"
