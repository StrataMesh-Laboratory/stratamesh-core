#!/usr/bin/env bash
# fog-mariadb-ensure.sh — idempotent MariaDB fog_cmn schema ensure (Mac Fog LAB)
# Soft-fail if brew/mysql missing. Never prints passwords.
# Vault (0600): FOG_MYSQL_URL, STAFF_GROK_PASSWORD, staff_grok.password, fog_mysql.password
# under ~/.config/stratamesh/ or ~/.config/stratagrok/ (+ optional secrets.env).
# See docs/FOG-HOST-FALLBACK.md + docs/FOG-MARIADB-ADAPTER.md
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SQL="${REPO_ROOT}/fog_cmn.mariadb.sql"
CFG_SM="${HOME}/.config/stratamesh"
CFG_SG="${HOME}/.config/stratagrok"
PATH="/usr/local/bin:/opt/homebrew/bin:${PATH:-/usr/bin:/bin}"

log() { printf 'fog-mariadb-ensure: %s\n' "$*"; }

_read_file_trim() {
  [[ -f "$1" && -s "$1" ]] || return 1
  tr -d '\r\n' <"$1"
}

_load_secrets_env() {
  local envf
  for envf in "${CFG_SM}/secrets.env" "${CFG_SG}/secrets.env"; do
    if [[ -f "$envf" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$envf" >/dev/null 2>&1 || true
      set +a
      return 0
    fi
  done
  return 1
}

_load_pw() {
  if [[ -n "${STAFF_GROK_PASSWORD:-}" ]]; then
    printf '%s' "$STAFF_GROK_PASSWORD"
    return 0
  fi
  local f
  for f in \
    "${CFG_SM}/STAFF_GROK_PASSWORD" \
    "${CFG_SM}/staff_grok.password" \
    "${CFG_SM}/fog_mysql.password" \
    "${CFG_SG}/STAFF_GROK_PASSWORD" \
    "${CFG_SG}/staff_grok.password"
  do
    if _read_file_trim "$f"; then
      return 0
    fi
  done
  return 1
}

_load_url() {
  if [[ -n "${FOG_MYSQL_URL:-}" ]]; then
    printf '%s' "$FOG_MYSQL_URL"
    return 0
  fi
  local f
  for f in "${CFG_SM}/FOG_MYSQL_URL" "${CFG_SG}/FOG_MYSQL_URL"; do
    if _read_file_trim "$f"; then
      return 0
    fi
  done
  return 1
}

if [[ ! -f "$SQL" ]]; then
  log "SKIP no schema file at fog_cmn.mariadb.sql"
  exit 0
fi

MYSQL_BIN=""
if command -v mysql >/dev/null 2>&1; then
  MYSQL_BIN="$(command -v mysql)"
elif [[ -x /usr/local/bin/mysql ]]; then
  MYSQL_BIN=/usr/local/bin/mysql
elif [[ -x /opt/homebrew/bin/mysql ]]; then
  MYSQL_BIN=/opt/homebrew/bin/mysql
fi

if [[ -z "$MYSQL_BIN" ]]; then
  if ! command -v brew >/dev/null 2>&1; then
    log "SOFT-FAIL brew and mysql missing — install later (brew install mariadb)"
    exit 0
  fi
  log "SOFT-FAIL mysql client missing (brew present) — brew install mariadb when ready"
  exit 0
fi

_load_secrets_env || true

HOST="${FOG_MYSQL_HOST:-127.0.0.1}"
PORT="${FOG_MYSQL_PORT:-3306}"
USER="${FOG_MYSQL_USER:-grok}"
DB="${FOG_MYSQL_DB:-fog_cmn}"
STAFF_GROK_PASSWORD="${STAFF_GROK_PASSWORD:-}"

if URL="$(_load_url)"; then
  FOG_MYSQL_URL="$URL"
  _parsed="$(FOG_MYSQL_URL="$FOG_MYSQL_URL" python3 - <<'PY'
import os
from urllib.parse import urlparse, unquote
u = urlparse(os.environ["FOG_MYSQL_URL"])
if u.scheme not in ("mysql", "mariadb"):
    raise SystemExit(1)
user = unquote(u.username or "grok")
host = u.hostname or "127.0.0.1"
port = u.port or 3306
db = (u.path or "/fog_cmn").lstrip("/") or "fog_cmn"
pwd = unquote(u.password or "")
print(f"{user}\t{host}\t{port}\t{db}\t{pwd}")
PY
)" || { log "SOFT-FAIL bad FOG_MYSQL_URL scheme"; exit 0; }
  IFS=$'\t' read -r USER HOST PORT DB URL_PWD <<<"$_parsed"
  if [[ -n "${URL_PWD}" ]]; then
    STAFF_GROK_PASSWORD="${URL_PWD}"
  fi
  unset URL_PWD _parsed URL
fi

if [[ -z "${STAFF_GROK_PASSWORD}" ]]; then
  STAFF_GROK_PASSWORD="$(_load_pw || true)"
fi

export MYSQL_PWD="${STAFF_GROK_PASSWORD:-}"
if ! "$MYSQL_BIN" -h "$HOST" -P "$PORT" -u "$USER" "$DB" -e "SELECT 1" >/dev/null 2>&1; then
  unset MYSQL_PWD
  log "SOFT-FAIL cannot connect as ${USER}@${HOST}:${PORT}/${DB} — schema not applied (SQLite remains default)"
  exit 0
fi

if ! "$MYSQL_BIN" -h "$HOST" -P "$PORT" -u "$USER" "$DB" <"$SQL" >/dev/null 2>&1; then
  unset MYSQL_PWD
  log "SOFT-FAIL schema apply failed — leaving existing DB untouched"
  exit 0
fi
unset MYSQL_PWD
log "OK fog_cmn schema ensured (exclusive-off ready when FOG_MYSQL_URL set)"
exit 0
