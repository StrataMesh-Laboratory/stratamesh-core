#!/usr/bin/env bash
# Harden Mac bring-up: daemon check + compose vs docker-compose + vaulted auth key.
# Never prints the key. Do not buy Tailscale seats. Exit-node forbidden.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

KEY_FILE="${TS_AUTHKEY_FILE:-$HOME/.config/stratagrok/tailscale-container-auth.key}"

die() { echo "compose-up: $*" >&2; exit 1; }

if ! command -v docker >/dev/null 2>&1; then
  die "docker not on PATH — install/start Docker Desktop on mbpv (André gate)."
fi

if ! docker info >/dev/null 2>&1; then
  die "Docker daemon not reachable. Start Docker Desktop on mbpv, then re-run. (André gate if Desktop is stopped.)"
fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    # Legacy hyphen binary (flag differences vs plugin are why we wrap).
    docker-compose "$@"
  else
    die "neither 'docker compose' nor 'docker-compose' available. Update Docker Desktop."
  fi
}

if [[ -z "${TS_AUTHKEY:-}" ]]; then
  [[ -f "$KEY_FILE" ]] || die "missing vault key at $KEY_FILE (mode 0600). Sync via desk vault — do not paste in chat."
  # shellcheck disable=SC2002
  TS_AUTHKEY="$(tr -d '\n\r ' <"$KEY_FILE")"
  export TS_AUTHKEY
fi
[[ -n "$TS_AUTHKEY" ]] || die "TS_AUTHKEY empty after vault read"

echo "compose-up: bringing lab-tailscale (tag:container, userspace, no exit-node)…"
compose up -d
compose ps
echo "compose-up: ok — next: compose logs -f tailscale  (expect tagged node on tailnet)"
