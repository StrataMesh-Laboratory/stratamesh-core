#!/usr/bin/env bash
# fog-node-run.sh — Mac Fog LaunchAgent entrypoint
# Sources MariaDB exclusive-off env (load-fog-mysql.sh) without echoing secrets,
# then execs venv python with the remaining args (node_persistent.py …).
# See docs/FOG-HOST-FALLBACK.md + docs/FOG-MARIADB-ADAPTER.md
set -euo pipefail

FOG_HOME="${FOG_HOME:-${HOME}/StrataMesh/fog}"
export PATH="/usr/local/bin:/opt/homebrew/bin:${PATH:-/usr/bin:/bin}"

LOAD="${HOME}/.config/stratamesh/load-fog-mysql.sh"
if [[ -f "${LOAD}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${LOAD}" >/dev/null 2>&1 || true
  set +a
fi

PY="${FOG_PYTHON:-${FOG_HOME}/venv/bin/python3}"
if [[ ! -x "${PY}" ]]; then
  PY="$(command -v python3)"
fi

exec "${PY}" "$@"
