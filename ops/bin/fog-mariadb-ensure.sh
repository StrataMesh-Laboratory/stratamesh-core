#!/usr/bin/env bash
# Discoverability wrapper → deploy/mac-fog/mariadb/fog-mariadb-ensure.sh
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$ROOT/deploy/mac-fog/mariadb/fog-mariadb-ensure.sh" "$@"
