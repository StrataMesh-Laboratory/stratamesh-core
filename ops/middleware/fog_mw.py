#!/usr/bin/env python3
"""Fog Python middleware — loopback CMN hop helper.

Ports: 8790. Talks cap / metabol / plugin roster. Not public origin.
/api/auth/* is a JSON session fallback (never 405/501/HTML, never error=stasis).
"""
from __future__ import annotations

import json
import os
import secrets
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen

PORT = int(os.environ.get("FOG_MW_PY_PORT") or "8790")
WORKERD = os.environ.get("WORKERD_HEALTH") or "http://127.0.0.1:8788"
FOG = os.environ.get("FOG_HEALTH") or "http://127.0.0.1:8787"
EDGE = "https://edge.calhegasmorais.pt"
FOG_PUB = "https://fog.calhegasmorais.pt"
SESS = {}  # token -> {email, exp, kind}
HOP = "python:8790"


def _j(url, timeout=1.2):
    try:
        req = Request(url, headers={"User-Agent": "fog-mw-py/1"})
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode() or "{}")
    except Exception as e:
        return {"ok": False, "error": str(e)[:120]}


def _cap():
    try:
        import sys
        src = os.environ.get("FOG_SRC") or ""
        path = src if src.endswith("src") else (src + "/src" if src else "")
        if path and path not in sys.path:
            sys.path.insert(0, path)
        from fog_plugins import host_cap
        return host_cap.snapshot()
    except Exception as e:
        return {"ok": False, "error": str(e)[:80]}


def payload(kind: str):
    cap = _cap()
    over = bool(cap.get("over"))
    base = {
        "ok": True,
        "runtime": "python",
        "port": PORT,
        "role": "middleware",
        "listening": True,
        "release": "v0.5.1-lab",
        "over": over,
        "node_id": "FOG-NODE-PT-CM-001",
        "edge_id": "EDGE-GROK-CMN-001",
        "n": 2,
        "mesh_member": True,
        "oracle_live": False,
        "cap": cap,
    }
    if kind == "health":
        return base
    if kind == "cap":
        return {"ok": True, "runtime": "python", "cap": cap}
    if kind == "cmn":
        return {
            **base,
            "hop": "internet→tunnel→workerd:8788→fog:8787 | mw py:8790 node:8791",
            "public": {"fog": FOG_PUB, "edge": EDGE},
            "loopback": {"workerd": WORKERD, "fog": FOG, "py": f"http://127.0.0.1:{PORT}"},
            "plugins": ["host_cap", "keepup", "ping", "rails", "tmp_sweep", "runtime_mesh"],
        }
    if kind == "plugins":
        live = {}
        try:
            import sys
            src = os.environ.get("FOG_SRC") or ""
            path = src if src.endswith("src") else (src + "/src" if src else "")
            if path and path not in sys.path:
                sys.path.insert(0, path)
            from fog_plugins import host_cap
            snap = host_cap.snapshot()
            live["host_cap"] = {"ok": True, "over": bool(snap.get("over")), "reason": snap.get("reason")}
        except Exception as e:
            live["host_cap"] = {"ok": False, "error": str(e)[:80]}
        for name in ("keepup", "ping", "rails", "tmp_sweep", "runtime_mesh"):
            try:
                __import__("fog_plugins." + name)
                live[name] = {"ok": True, "import": True}
            except Exception as e:
                live[name] = {"ok": False, "error": str(e)[:80]}
        live["metabol"] = {"ok": True, "via": WORKERD + "/metabol", "snap": _j(WORKERD + "/metabol")}
        live["workerd"] = _j(WORKERD + "/health")
        live["fog"] = _j(FOG + "/health")
        return {"ok": True, "runtime": "python", "port": PORT, "plugins": live}
    if kind == "metabol":
        return {"ok": True, "via": WORKERD + "/metabol", "snap": _j(WORKERD + "/metabol")}
    if kind == "strata":
        fog = _j(FOG + "/status") or _j(FOG + "/health")
        return {
            "ok": True,
            "runtime": "python",
            "role": "strata-observe",
            "release": "v0.5.1-lab",
            "fog": fog,
            "note": "observe only; mint stays rails+oracle_live",
        }
    if kind == "fallback":
        try:
            from fog_plugins.mac_fallback import tick
            return {"ok": True, "runtime": "python", **tick()}
        except Exception as e:
            return {"ok": False, "error": str(e)[:120]}
    return base


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _cors(self, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Allow", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Cache-Control", "no-store")

    def _send(self, code, obj):
        raw = json.dumps(obj).encode()
        self._cors(code)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _body(self):
        n = int(self.headers.get("Content-Length") or self.headers.get("content-length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw.decode() or "{}")
        except Exception:
            return {}

    def _auth(self):
        path = self.path.split("?", 1)[0]
        method = self.command
        if path.rstrip("/").endswith("/health"):
            return self._send(200, {
                "ok": True,
                "hop": HOP,
                "role": "auth-fallback+middleware",
            })
        body = self._body() if method in ("POST", "PUT") else {}
        if path.endswith("/login") or path.endswith("/email"):
            email = str(body.get("email") or "").strip().lower()
            if not email:
                return self._send(400, {"ok": False, "error": "email", "hop": HOP})
            token = secrets.token_urlsafe(24)
            SESS[token] = {"email": email, "exp": time.time() + 3600, "kind": "fallback"}
            return self._send(200, {
                "ok": True,
                "success": True,
                "hop": HOP,
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
            return self._send(200, {
                "ok": True,
                "success": True,
                "hop": HOP,
                "mode": "fallback",
                "token": token,
                "email": email,
            })
        if path.endswith("/me") or path.rstrip("/").endswith("/auth"):
            hdr = self.headers.get("Authorization") or self.headers.get("authorization") or ""
            token = hdr.split(" ", 1)[-1] if hdr else ""
            rec = SESS.get(token)
            if rec and rec["exp"] > time.time():
                return self._send(200, {
                    "ok": True,
                    "success": True,
                    "hop": HOP,
                    "email": rec["email"],
                    "kind": rec["kind"],
                })
            return self._send(401, {"ok": False, "error": "no_session", "hop": HOP})
        return self._send(200, {
            "ok": True,
            "hop": HOP,
            "mode": "fallback",
            "path": path,
            "method": method,
            "role": "auth-fallback+middleware",
        })

    def do_OPTIONS(self):
        self._cors(204)
        self.end_headers()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/auth"):
            return self._auth()
        self._send(404, {"ok": False, "error": "not found", "path": path, "hop": HOP})

    def do_PUT(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/auth"):
            return self._auth()
        self._send(404, {"ok": False, "error": "not found", "path": path, "hop": HOP})

    def do_DELETE(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/auth"):
            return self._auth()
        self._send(404, {"ok": False, "error": "not found", "path": path, "hop": HOP})

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/auth"):
            return self._auth()
        table = {
            "/": "health",
            "/health": "health",
            "/mw/health": "health",
            "/cap": "cap",
            "/mw/cap": "cap",
            "/cmn": "cmn",
            "/mw/cmn": "cmn",
            "/plugins": "plugins",
            "/mw/plugins": "plugins",
            "/metabol": "metabol",
            "/mw/metabol": "metabol",
            "/fallback": "fallback",
            "/mw/fallback": "fallback",
            "/strata": "strata",
            "/mw/strata": "strata",
        }
        kind = table.get(path)
        if not kind:
            self._send(404, {"ok": False, "error": "not found", "path": path})
            return
        self._send(200, payload(kind))


def main():
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()


if __name__ == "__main__":
    main()
