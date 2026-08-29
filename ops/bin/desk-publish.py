#!/usr/bin/env python3
"""Q-gated CF Worker PUT from this git tree. Dispatch only. Never wrangler deploy.

Allow-list only. HOLD (exit 0) if GraphQL missing or circuit HOLD/STASIS.
Exit 1 on PUT failure. Never workers.dev. Never a 6th cron.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def load_tick():
    spec = importlib.util.spec_from_file_location("desk_tick", ROOT / "ops" / "bin" / "desk-tick.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

ALLOW = {
    "stratamesh-spa": "workers/stratamesh-spa.js",
    "stratamesh-status": "workers/stratamesh-status.js",
    "stratamesh-gossip": "workers/stratamesh-gossip.js",
    "stratamesh-orchestrator": "workers/stratamesh-orchestrator.js",
    "stratamesh-aiops": "workers/stratamesh-aiops.js",
    "stratamesh-deomail": "workers/stratamesh-deomail.js",
    "stratamesh-briefing": "workers/stratamesh-briefing.js",
    "stratamesh-fund": "stratamesh-impact-fund/workers/stratamesh-fund.js",
}


def load_agl():
    spec = importlib.util.spec_from_file_location(
        "agl", ROOT / "scripts" / "api-gitlive-publish.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    raw = os.environ.get("DESK_PUBLISH_SCRIPTS") or "stratamesh-status"
    wanted = [s.strip() for s in raw.split(",") if s.strip()]
    unknown = [s for s in wanted if s not in ALLOW]
    if unknown:
        print("HOLD unknown scripts (not allow-listed): " + ",".join(unknown), file=sys.stderr)
        return 1

    email = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"
    tok = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not tok and Path("/tmp/god_api").is_file():
        tok = Path("/tmp/god_api").read_text().strip()
    if not tok:
        print("HOLD: no GOD_API — fail closed, no PUT", file=sys.stderr)
        return 0

    tick = load_tick()
    metab = tick.cf_graphql(email, tok) or {"error": "graphql none"}
    print("metabolism", metab)
    if metab.get("error"):
        print("HOLD: no live remaining sample — fail closed", file=sys.stderr)
        return 0
    if metab.get("circuit_stasis") or metab.get("circuit_hold"):
        print("HOLD: circuit breaker — no PUT this hour", file=sys.stderr)
        return 0
    if int(metab.get("remaining") or 0) < 500:
        print("HOLD: remaining < 500", file=sys.stderr)
        return 0

    agl = load_agl()
    failed = []
    for script in wanted:
        rel = ALLOW[script]
        src = ROOT / rel
        if not src.is_file():
            failed.append(script + ": missing " + rel)
            continue
        main_mod = agl.MAIN_MODULE.get(script) or "index.js"
        out = agl.cf_put_content(email, tok, src, script=script, main_module=main_mod)
        print(script, "http", out.get("http"), "success", out.get("success"))
        if not out.get("success"):
            failed.append(script + ": " + str(out.get("errors") or out.get("http")))
    if failed:
        print("PUT FAIL " + " | ".join(failed), file=sys.stderr)
        return 1
    print("published", ",".join(wanted))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
