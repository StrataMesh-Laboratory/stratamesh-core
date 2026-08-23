#!/usr/bin/env bash
# One-command LAB protocol benchmark (WIRE-PROTOCOL-v1 / THREAT-MODEL-v1)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/src"
exec python3 protocol_benchmark.py "$@"
