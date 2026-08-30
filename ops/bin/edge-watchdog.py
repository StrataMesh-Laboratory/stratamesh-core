#!/usr/bin/env python3
"""Unprompted EDGE self-start.

If localhost workerd :8788 is not origin=edge, start edge-persist.
Does not touch Mac fog or macbook-server. 15s cadence.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(os.environ.get("FOG_SRC") or "/tmp/sm-core")
DATA = Path(os.environ.get("EDGE_DATA") or "/workspace/data/edge")
LOCAL = os.environ.get("EDGE_HOP_URL") or "http://127.0.0.1:8788/health"
PUBLIC = os.environ.get("EDGE_PUBLIC_URL") or "https://edge.calhegasmorais.pt/health"
POLL = int(os.environ.get("EDGE_POLL_SEC") or "15")
LOG = DATA / "edge-watchdog.log"


def log(msg: str) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    line = time.strftime("%Y-%m-%dT%H:%M:%SZ ", time.gmtime()) + msg + "\n"
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(line)


def probe(url: str) -> dict:
    try:
        req = Request(url, headers={"User-Agent": "edge-watchdog/1"})
        with urlopen(req, timeout=5) as r:
            return {"ok": r.status == 200, **json.loads(r.read().decode())}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def persist_running() -> bool:
    p = DATA / "edge-persist.pid"
    if not p.is_file():
        return False
    try:
        pid = int(p.read_text().strip())
        os.kill(pid, 0)
        return True
    except Exception:
        return False


def start_persist() -> None:
    env = os.environ.copy()
    env["FOG_ORIGIN"] = "edge"
    env["FOG_SRC"] = str(ROOT)
    log("self-start edge-persist (uptime ping miss)")
    subprocess.Popen(
        [sys.executable, str(ROOT / "ops" / "bin" / "edge-persist.py")],
        env=env,
        start_new_session=True,
    )


def main() -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    log("watchdog on")
    while True:
        hop = probe(LOCAL)
        if not (hop.get("ok") and hop.get("origin") == "edge"):
            log("local hop down: %s" % hop)
            if not persist_running():
                start_persist()
        pub = probe(PUBLIC)
        # After DNS cutover, public must be origin=edge. Worker desk is not the hop.
        if pub.get("ok") and pub.get("origin") and pub.get("origin") != "edge" and pub.get("runtime") != "workerd":
            log("public still Worker desk (DNS HOLD) — local hop is source of truth")
        time.sleep(POLL)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
