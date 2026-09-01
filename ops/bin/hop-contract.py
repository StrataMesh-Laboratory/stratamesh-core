#!/usr/bin/env python3
"""Hop contract — workerd + python mw + node compose. No secrets. No live Mac."""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


def must(path: str, *needles: str) -> None:
    text = (ROOT / path).read_text(encoding="utf-8")
    missing = [n for n in needles if n not in text]
    if missing:
        raise SystemExit("%s missing %s" % (path, missing))


def main() -> int:
    must(
        "ops/workerd/worker.js",
        "/health",
        "/metabol",
        "/assemble",
        "MW_NODE",
        "0.5.0-lab",
    )
    must(
        "ops/workerd/config.capnp",
        "mwpy",
        "mwnode",
        "127.0.0.1:8790",
        "127.0.0.1:8791",
    )
    must(
        "ops/middleware/fog_mw.py",
        "/strata",
        "/plugins",
        "/fallback",
        "host_cap",
        "v0.5.0-lab",
    )
    must(
        "ops/middleware/fog_mw.js",
        "role: \"compose\"",
        "/assemble",
        "Promise.all",
        "/atelier",
        "/dashboard",
        "v0.5.0-lab",
    )
    must(
        "src/fog_plugins/runtime_mesh.py",
        "8790",
        "8791",
        "fog_mw.py",
        "fog_mw.js",
    )
    must(
        "src/fog_plugins/mac_fallback.py",
        "1800",
        "standby",
    )
    print("hop-contract ok")
    print("  tunnel → workerd:8788 (isolate, metabol)")
    print("  workerd → fog:8787 (origin)")
    print("  workerd /assemble → node:8791 (compose)")
    print("  python:8790 (cap, plugins, strata, fallback)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
