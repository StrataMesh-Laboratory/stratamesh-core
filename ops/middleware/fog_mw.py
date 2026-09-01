#!/usr/bin/env python3
"""Fog Python middleware — loopback only. Cap-aware. Not public origin."""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("FOG_MW_PY_PORT") or "8790")


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send(self, code, obj):
        raw = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.split("?", 1)[0] in ("/", "/health", "/mw/health"):
            over = False
            try:
                import sys
                src = os.environ.get("FOG_SRC")
                if src and src not in sys.path:
                    sys.path.insert(0, src if src.endswith("src") else src + "/src")
                from fog_plugins import host_cap
                snap = host_cap.snapshot()
                over = bool(snap.get("over"))
            except Exception:
                snap = {}
            self._send(200, {
                "ok": not over,
                "runtime": "python",
                "port": PORT,
                "role": "middleware",
                "cap": snap,
            })
            return
        self._send(404, {"ok": False})


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
