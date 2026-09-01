#!/usr/bin/env python3
"""Python :8790 — standard auth fallback when CF Workers are capped (1027/405).
No KV. POST/GET/OPTIONS on /api/auth/* always JSON — never HTTP 405.
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json, os, secrets, time
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(os.environ.get("FOG_SRC", ".")) / "frontend"
PORT = int(os.environ.get("SPA_PY_PORT") or os.environ.get("FOG_MW_PY_PORT") or 8790)
SESS = {}  # token -> {email, exp}


class H(BaseHTTPRequestHandler):
    def _cors(self, code=200, ctype="application/json"):
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "Authorization, Content-Type")
        self.send_header("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("allow", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("cache-control", "no-store")

    def do_OPTIONS(self):
        self._cors(204)
        self.end_headers()

    def do_HEAD(self):
        self._cors(204)
        self.end_headers()

    def do_PUT(self):
        self._auth()

    def do_DELETE(self):
        self._auth()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/health":
            return self._json(200, {"ok": True, "runtime": "python", "role": "auth-fallback-standard", "port": PORT, "sessions": len(SESS), "peers": ["deno:8792", "node:8791"]})
        if path.startswith("/api/auth"):
            return self._auth()
        rel = {"/": "sandbox.html", "/dashboard": "portal-pt.html"}.get(path, path.lstrip("/"))
        fp = (ROOT / rel).resolve()
        if str(fp).startswith(str(ROOT.resolve())) and fp.is_file():
            data = fp.read_bytes()
            self._cors(200, "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(data)
            return
        hold = ROOT / "maintenance-1xxx.html"
        if hold.is_file():
            self._cors(503, "text/html; charset=utf-8"); self.end_headers(); self.wfile.write(hold.read_bytes()); return
        self._json(404, {"error": "not found", "hop": "python:8790"})

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/auth"):
            return self._auth()
        hold = ROOT / "maintenance-1xxx.html"
        if hold.is_file():
            self._cors(503, "text/html; charset=utf-8"); self.end_headers(); self.wfile.write(hold.read_bytes()); return
        self._json(404, {"error": "not found", "hop": "python:8790"})

    def _body(self):
        n = int(self.headers.get("content-length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw.decode() or "{}")
        except Exception:
            return {}

    def _auth(self):
        path = self.path.split("?", 1)[0]
        method = self.command
        body = self._body() if method in ("POST", "PUT") else {}
        if path.endswith("/login") or path.endswith("/email"):
            email = str(body.get("email") or "").strip().lower()
            if not email:
                return self._json(400, {"ok": False, "error": "email", "hop": "python:8790"})
            token = secrets.token_urlsafe(24)
            SESS[token] = {"email": email, "exp": time.time() + 3600, "kind": "fallback"}
            return self._json(200, {
                "ok": True,
                "hop": "python:8790",
                "mode": "fallback",
                "token": token,
                "email": email,
                "need_2fa": False,
                "note": "CF workers capped; local 1h session",
            })
        if path.endswith("/verify") or path.endswith("/email/verify"):
            email = str(body.get("email") or "").strip().lower()
            token = secrets.token_urlsafe(24)
            SESS[token] = {"email": email or "session", "exp": time.time() + 3600, "kind": "fallback"}
            return self._json(200, {"ok": True, "hop": "python:8790", "mode": "fallback", "token": token, "email": email})
        if path.endswith("/me") or path.rstrip("/").endswith("/auth"):
            hdr = self.headers.get("authorization") or ""
            token = hdr.split(" ", 1)[-1] if hdr else ""
            rec = SESS.get(token)
            if rec and rec["exp"] > time.time():
                return self._json(200, {"ok": True, "hop": "python:8790", "email": rec["email"], "kind": rec["kind"]})
            return self._json(401, {"ok": False, "error": "no_session", "hop": "python:8790"})
        return self._json(200, {"ok": True, "hop": "python:8790", "mode": "fallback", "path": path, "method": method})

    def _json(self, code, obj):
        raw = json.dumps(obj).encode()
        self._cors(code)
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        print("cmn-spa-python", fmt % args)


if __name__ == "__main__":
    print("cmn-spa-python", PORT, "auth-fallback-standard", datetime.now(timezone.utc).isoformat())
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
