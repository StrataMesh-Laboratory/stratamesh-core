#!/usr/bin/env python3
"""Python :8790 — HTML + /api/auth fallback complementary to node:8791. No KV."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json, os, urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(os.environ.get("FOG_SRC", ".")) / "frontend"
PORT = int(os.environ.get("SPA_PY_PORT") or os.environ.get("FOG_MW_PY_PORT") or 8790)
CF_AUTH = os.environ.get("CF_AUTH_ORIGIN", "https://calhegasmorais.pt")

class H(BaseHTTPRequestHandler):
    def _cors(self, code=200, ctype="application/json"):
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "Authorization, Content-Type")
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("cache-control", "no-store")
    def do_OPTIONS(self):
        self._cors(204); self.end_headers()
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/health":
            return self._json(200, {"ok": True, "runtime": "python", "role": "spa-auth-fallback", "port": PORT})
        if path == "/api/auth/me":
            return self._json(503, {"ok": False, "error": "cf_stasis", "hop": "python:8790", "renewal": "00:00 UTC"})
        rel = {"/": "sandbox.html", "/dashboard": "portal-pt.html"}.get(path, path.lstrip("/"))
        fp = (ROOT / rel).resolve()
        if str(fp).startswith(str(ROOT.resolve())) and fp.is_file():
            data = fp.read_bytes()
            self._cors(200, "text/html; charset=utf-8"); self.end_headers(); self.wfile.write(data); return
        self._json(404, {"error": "not found", "hop": "python:8790"})
    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/auth/login":
            return self._json(503, {"ok": False, "error": "cf_stasis", "hop": "python:8790", "peer": "node:8791", "renewal": "00:00 UTC"})
        self._json(404, {"error": "not found"})
    def _json(self, code, obj):
        raw = json.dumps(obj).encode()
        self._cors(code); self.send_header("content-length", str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def log_message(self, fmt, *args):
        print("cmn-spa-python", fmt % args)

if __name__ == "__main__":
    print("cmn-spa-python", PORT, ROOT, datetime.now(timezone.utc).isoformat())
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
