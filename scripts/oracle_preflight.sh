#!/usr/bin/env bash
# Unit checks for the Oracle Always Free pack (no network required).
# Optional: --dns  → probe fog.calhegasmorais.pt (NXDOMAIN is WARN, not FAIL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DNS_CHECK=0
for arg in "$@"; do
  case "$arg" in
    --dns) DNS_CHECK=1 ;;
    -h|--help)
      echo "usage: $0 [--dns]"
      exit 0
      ;;
    *)
      echo "FAIL unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

FAILS=0
WARNS=0
fail() { echo "FAIL $*"; FAILS=$((FAILS + 1)); }
warn() { echo "WARN $*"; WARNS=$((WARNS + 1)); }
ok() { echo "OK $*"; }

BOOTSTRAP="$ROOT/deploy/oracle-free/bootstrap.sh"
if [[ ! -f "$BOOTSTRAP" ]]; then
  fail "missing $BOOTSTRAP"
else
  if grep -E 'amcmorais/stratamesh-core' "$BOOTSTRAP" >/dev/null 2>&1; then
    fail "bootstrap REPO_URL still points at amcmorais/stratamesh-core"
  elif grep -E 'REPO_URL=.*StrataMesh-Laboratory/stratamesh-core' "$BOOTSTRAP" >/dev/null 2>&1; then
    ok "bootstrap REPO_URL uses org repo"
  else
    fail "bootstrap REPO_URL does not default to StrataMesh-Laboratory/stratamesh-core"
  fi
fi

shopt -s nullglob
units=("$ROOT"/deploy/oracle-free/*.service)
if [[ ${#units[@]} -eq 0 ]]; then
  fail "no deploy/oracle-free/*.service files"
fi

token_bad=0
for unit in "${units[@]}"; do
  # STATUS_TOKEN= with a non-empty value is forbidden in committed units.
  if grep -E '^[[:space:]]*(Environment=)?STATUS_TOKEN=.+' "$unit" >/dev/null 2>&1; then
    fail "$(basename "$unit"): STATUS_TOKEN= has a non-empty value (use EnvironmentFile)"
    token_bad=1
  fi
done
if [[ $token_bad -eq 0 && ${#units[@]} -gt 0 ]]; then
  ok "no non-empty STATUS_TOKEN= in deploy/oracle-free/*.service"
fi

need_node=0
need_pub=0
for unit in "${units[@]}"; do
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*ExecStart= ]] || continue
    cmd="${line#ExecStart=}"
    if [[ "$cmd" == *node_persistent.py* ]]; then
      need_node=1
      py=""
      # word-split ExecStart tokens to find the script path
      # shellcheck disable=SC2086
      for tok in $cmd; do
        case "$tok" in
          *node_persistent.py) py="$tok" ;;
        esac
      done
      rel="${py#/opt/stratamesh-core/}"
      rel="${rel#./}"
      if [[ -n "$py" && -f "$ROOT/$rel" ]]; then
        ok "$(basename "$unit"): node_persistent.py present ($rel)"
      elif [[ -f "$ROOT/src/node_persistent.py" ]]; then
        ok "$(basename "$unit"): node_persistent.py present (src/node_persistent.py)"
      else
        fail "ExecStart node_persistent.py missing in tree (looked for ${rel:-?} and src/node_persistent.py)"
      fi
    fi
    if [[ "$cmd" == *publish_loop.sh* ]]; then
      need_pub=1
      sh=""
      # shellcheck disable=SC2086
      for tok in $cmd; do
        case "$tok" in
          *publish_loop.sh) sh="$tok" ;;
        esac
      done
      rel="${sh#/opt/stratamesh-core/}"
      rel="${rel#./}"
      if [[ -n "$sh" && -f "$ROOT/$rel" ]]; then
        ok "$(basename "$unit"): publish_loop.sh present ($rel)"
      elif [[ -f "$ROOT/scripts/publish_loop.sh" ]]; then
        ok "$(basename "$unit"): publish_loop.sh present (scripts/publish_loop.sh)"
      else
        fail "ExecStart publish_loop.sh missing in tree (looked for ${rel:-?} and scripts/publish_loop.sh)"
      fi
    fi
  done < "$unit"
done

if [[ $need_node -eq 0 ]]; then
  if [[ ! -f "$ROOT/src/node_persistent.py" ]]; then
    fail "src/node_persistent.py missing in tree"
  else
    warn "no ExecStart references node_persistent.py; src/node_persistent.py exists"
  fi
fi
if [[ $need_pub -eq 0 ]]; then
  if [[ ! -f "$ROOT/scripts/publish_loop.sh" ]]; then
    fail "scripts/publish_loop.sh missing in tree"
  else
    warn "no ExecStart references publish_loop.sh; scripts/publish_loop.sh exists"
  fi
fi

if [[ $DNS_CHECK -eq 1 ]]; then
  host="fog.calhegasmorais.pt"
  resolved="$(python3 -c 'import socket,sys
try:
    print(socket.getaddrinfo("fog.calhegasmorais.pt", None)[0][4][0])
except socket.gaierror:
    pass
' 2>/dev/null || true)"
  if [[ -n "${resolved:-}" ]]; then
    ok "DNS $host → $resolved"
  else
    warn "DNS $host NXDOMAIN/unresolved (expected until named tunnel exists; not FAIL)"
  fi
fi

echo "---"
echo "fails=$FAILS warns=$WARNS"
if [[ $FAILS -gt 0 ]]; then
  exit 1
fi
echo "oracle-free preflight OK"
