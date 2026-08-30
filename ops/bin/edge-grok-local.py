#!/usr/bin/env python3
"""EDGE-GROK-CMN-001 local grounding — this Grok session host.

Spare-capacity: nice 19. Port 8789 (Mac workerd owns 8788).
Non-continuous: dies with the session. Expected for EDGE.
Distinct host_id from the Mac Fog → honest n=2 mesh_member.
"""
from __future__ import annotations

import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

os.environ.setdefault("FOG_ORIGIN", "edge")
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from host_fingerprint import fingerprint  # noqa: E402
from mesh_provision import EDGE_ID, FOG_ID, flags  # noqa: E402

PORT = int(os.environ.get("EDGE_PORT") or "8789")
FOG_HEALTH = os.environ.get("FOG_PUBLIC_HEALTH") or "https://fog.calhegasmorais.pt/health"
STATE = Path(os.environ.get("EDGE_STATE") or "/workspace/data/edge")
STARTED = time.time()


def probe_fog() -> dict:
    try:
        req = Request(FOG_HEALTH, headers={"User-Agent": EDGE_ID, "X-StrataMesh-Caller": EDGE_ID})
        with urlopen(req, timeout=5) as r:
            body = json.loads(r.read().decode())
            return {"ok": r.status == 200, "http": r.status, **body}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def payload() -> dict:
    fp = fingerprint()
    fog = probe_fog()
    mf = flags()
    return {
        "ok": True,
        "node_id": EDGE_ID,
        "role": "edge",
        "substrate": "grok-session-local",
        "continuity": "session",
        "lab": True,
        "version": "0.2.3-dev",
        "linked_fog": FOG_ID,
        "host_id": fp["host_id"],
        "host_id_source": fp["source"],
        "uptime_seconds": int(time.time() - STARTED),
        "port": PORT,
        "fog": {
            "ok": fog.get("ok"),
            "origin": fog.get("origin"),
            "mac_live": fog.get("mac_live"),
            "http": fog.get("http") or fog.get("status"),
        },
        **mf,
        "note": "EDGE local grounding; non-continuous expected. Distinct host_id from Mac Fog.",
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("edge-grok " + (fmt % args) + "\n")

    def _json(self, code, obj):
        raw = json.dumps(obj, indent=2).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/health", "/status"):
            self._json(200, payload())
            return
        self._json(404, {"ok": False, "error": "not found"})


def main() -> int:
    try:
        os.nice(19)
    except Exception:
        pass
    STATE.mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("EDGE-GROK-CMN-001 local :%d host_id=%s" % (PORT, fingerprint()["host_id"]), flush=True)
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
