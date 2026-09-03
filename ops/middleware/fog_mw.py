#!/usr/bin/env python3
"""Fog Python middleware — loopback CMN hop helper.

Ports: 8790. Talks cap / metabol / plugin roster. Not public origin.
Public aliases (macbook-server tunnel): auth.calhegasmorais.pt, mw.calhegasmorais.pt.

This hop is the contingency/no-cap rail for Workbench dynamic session/state.
Workers/KV stay paced (KV 50% cap; Workers 100k/day; sandbox-host burned 1.2M,
auth 736k on 1 Sep). Freeze only after pace fails AND this hop is down.
Do not PUT Workers or add a 6th cron to "fix" KV.

/api/auth/* is a JSON session fallback (never 405/501/HTML, never error=stasis).
/api/wb/* is cheap in-memory Workbench state (not KV).
"""
from __future__ import annotations

import json
import os
import secrets
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen

PORT = int(os.environ.get("FOG_MW_PY_PORT") or "8790")
WORKERD = os.environ.get("WORKERD_HEALTH") or "http://127.0.0.1:8788"
FOG = os.environ.get("FOG_HEALTH") or "http://127.0.0.1:8787"
EDGE = "https://edge.calhegasmorais.pt"
FOG_PUB = "https://fog.calhegasmorais.pt"
SESS = {}  # token -> {email, exp, kind}
WB = {}  # token -> {nfts, avatarId, at}  in-memory Workbench; not KV
HOP = "python:8790"
NODE = os.environ.get("FOG_MW_NODE") or "http://127.0.0.1:8791"
DENO = os.environ.get("FOG_MW_DENO") or "http://127.0.0.1:8792"
MESH = {
    "fog": 8787,
    "role": "kernel",
    "ipc": {"workerd": 8788, "python": 8790, "node": 8791, "deno": 8792},
    "mw": ["workerd:8788", "python:8790", "node:8791", "deno:8792"],
    "routes": {
        "auth_wb_session": ["python:8790", "node:8791", "deno:8792", "cf-auth:ALLOW", "frontend/maintenance-1xxx.html"],
        "compose_assemble_desk": ["node:8791", "python:8790", "deno:8792", "cf-pages:ALLOW", "frontend/maintenance-1xxx.html"],
        "object_cid_mail": ["deno:8792", "python:8790", "node:8791", "cf-deomail:ALLOW", "frontend/maintenance-1xxx.html"],
        "html_atelier": ["node:8791/atelier", "python:8790", "workerd:8788", "cf-pages:ALLOW", "frontend/maintenance-1xxx.html"],
        "html": ["pages", "node:8791/atelier", "python:8790", "workerd:8788", "frontend/maintenance-1xxx.html"],
        "metabol_origin": ["workerd:8788", "python:8790", "node:8791", "cf-metabol:ALLOW", "frontend/maintenance-1xxx.html"],
    },
}

DEFAULT_OWNER = "FOG-NODE-PT-CM-001"
_REG = None


def _src_path():
    src = os.environ.get("FOG_SRC") or ""
    if src.endswith("src"):
        return src
    if src:
        return src + "/src"
    here = os.path.abspath(os.path.dirname(__file__))
    # ops/middleware -> repo root /src
    return os.path.abspath(os.path.join(here, "..", "..", "src"))


def _registry():
    global _REG
    if _REG is not None:
        return _REG
    path = _src_path()
    if path and path not in sys.path:
        sys.path.insert(0, path)
    from nft import ObjectRegistry
    _REG = ObjectRegistry()
    return _REG


def _cid_only_json(cid, extra=None, payload=None):
    body = {
        "ok": True,
        "hop": HOP,
        "object_id": None,
        "manifest_cid": cid,
        "cid": cid,
        "dag_tx": None,
        "mode": "cid_only",
        "objects": [],
        "layers": {
            "cid": {"manifest_cid": cid, "parts": payload if payload is not None else {}},
            "dag": {"vertex": None, "tx_type": None},
            "nft": {"id": None, "note": "cid_only; no object_id mint"},
            "strata": {
                "collateral_strata": 0,
                "strata_units": 0,
                "reserved": True,
                "oracle_live": False,
            },
        },
    }
    if extra:
        body.update(extra)
    return body


def _object_json(obj, extra=None, parts_listed=None):
    from nft import layers_payload
    body = {
        "ok": True,
        "hop": HOP,
        "object_id": obj.object_id or None,
        "manifest_cid": obj.manifest_cid,
        "dag_tx": obj.dag_tx,
        "owner": obj.owner,
        "kind": obj.kind,
        "title": obj.title,
        "renderer": obj.renderer,
        "layers": layers_payload(obj, parts_listed=parts_listed),
        "object": obj.to_dict(),
    }
    if extra:
        body.update(extra)
    return body


def handle_object(method, path, body):
    """POST /object/compose|/register  PUT/POST /object/cid  GET /object/list|/cid/:cid|/:id"""
    segs = [s for s in path.split("/") if s]
    try:
        reg = _registry()
    except Exception as e:
        return 503, {"ok": False, "error": "registry", "detail": str(e)[:160], "hop": HOP}

    if method in ("PUT", "POST") and (
        path.rstrip("/") == "/object/cid" or path.startswith("/object/cid/")
    ):
        cid = ""
        if path.startswith("/object/cid/"):
            cid = path.split("/object/cid/", 1)[-1].strip("/")
        cid = cid or str(body.get("cid") or body.get("manifest_cid") or "").strip()
        payload = body.get("payload") if isinstance(body, dict) and "payload" in body else body
        if not cid:
            try:
                from nft import content_cid
                cid = content_cid(payload if payload is not None else {})
            except Exception as e:
                return 400, {"ok": False, "error": str(e)[:160], "hop": HOP}
        try:
            rec = reg.put_cid(cid, payload if isinstance(payload, dict) else {"raw": payload})
        except ValueError as e:
            return 400, {"ok": False, "error": str(e), "hop": HOP, "oracle_live": False}
        return 200, _cid_only_json(cid, extra={"put": True, "created_at": rec.get("created_at")}, payload=rec.get("payload"))

    if method == "POST" and path.rstrip("/") in ("/object/compose", "/object/register"):
        owner = str(body.get("owner") or body.get("creator") or DEFAULT_OWNER).strip() or DEFAULT_OWNER
        creator = str(body.get("creator") or owner or DEFAULT_OWNER)
        if creator.lower() == "atelier":
            creator = owner or DEFAULT_OWNER
        title = str(body.get("name") or body.get("title") or "")
        kind = str(body.get("kind") or "ugc")
        renderer = body.get("renderer")
        if renderer is not None:
            renderer = str(renderer) or None
        parts = body.get("parts") or body.get("components") or {}
        if not isinstance(parts, dict):
            parts = {}
        manifest_cid = str(body.get("manifest_cid") or body.get("cid") or "").strip() or None
        strata_units = body.get("strata_units", body.get("collateral_strata", 0))
        cid_only = bool(body.get("cid_only"))
        mint = body.get("mint", True)
        if mint in (False, "false", "0", 0, "no"):
            mint = False
            cid_only = True
        try:
            obj = reg.compose(
                owner=owner,
                manifest_cid=manifest_cid,
                parts=parts,
                kind=kind,
                title=title,
                renderer=renderer,
                meta={"creator": creator, "world_id": body.get("world_id")},
                strata_units=strata_units if strata_units is not None else 0,
                cid_only=cid_only,
                mint=mint,
            )
        except ValueError as e:
            return 400, {"ok": False, "error": str(e), "hop": HOP, "oracle_live": False}
        if cid_only or not obj.object_id:
            return 200, _object_json(obj, extra={"mode": "cid_only", "creator": creator})
        return 200, _object_json(obj, extra={"mode": "four_layer_register", "creator": creator})

    if method == "GET" and path.rstrip("/") == "/object/list":
        items = [o.to_dict() for o in reg.list(limit=100)]
        return 200, {"ok": True, "hop": HOP, "n": len(items), "objects": items}

    if method == "GET" and path.startswith("/object/cid/"):
        cid = path.split("/object/cid/", 1)[-1].strip("/")
        items = [o.to_dict() for o in reg.by_cid(cid)]
        if items:
            return 200, {"ok": True, "hop": HOP, "cid": cid, "objects": items, "object": items[0]}
        stored = reg.get_cid(cid)
        if stored:
            return 200, _cid_only_json(cid, extra={"created_at": stored.get("created_at")}, payload=stored.get("payload"))
        return 404, {"ok": False, "error": "not found", "cid": cid, "hop": HOP}

    if method == "GET" and len(segs) == 2 and segs[0] == "object":
        oid = segs[1]
        obj = reg.get(oid)
        if not obj:
            return 404, {"ok": False, "error": "not found", "object_id": oid, "hop": HOP}
        return 200, _object_json(obj)

    return 404, {"ok": False, "error": "not found", "path": path, "hop": HOP}



def _j(url, timeout=1.2):
    try:
        req = Request(url, headers={"User-Agent": "fog-mw-py/1"})
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode() or "{}")
    except Exception as e:
        return {"ok": False, "error": str(e)[:120]}



def _lib_path():
    path = _src_path()
    return os.path.abspath(os.path.join(path, "..", "ops", "lib"))


def _hop_chain():
    lib = _lib_path()
    if lib not in sys.path:
        sys.path.insert(0, lib)
    import hop_chain
    return hop_chain


def _chain_dispatch(handler, path, method, body_bytes=None):
    """Try-next 3 MW then CF ALLOW then maintenance. /health never enters."""
    try:
        hc = _hop_chain()
    except Exception:
        return False
    if hc.is_health(path):
        return False
    hdr = {}
    try:
        hdr = {k: handler.headers.get(k) for k in handler.headers.keys()}
    except Exception:
        hdr = {}
    pace = _metabol_pace("python")
    decision = str((pace or {}).get("decision") or "ALLOW")

    def local(_p):
        return {"skip": True, "via": "local"}

    def fetch(url, method="GET", headers=None, body=None, timeout=1.2):
        h = dict(headers or {})
        h.setdefault("User-Agent", "fog-mw-py/chain")
        req = Request(url, data=body, method=method, headers=h)
        with urlopen(req, timeout=timeout) as r:
            return int(getattr(r, "status", 200) or 200), dict(r.headers.items()), r.read()

    out = hc.try_next(
        path,
        self_hop=HOP,
        method=method,
        headers=hdr,
        body=body_bytes,
        decision=decision,
        fetch=fetch,
        local=local,
        policy={"routes": MESH["routes"]},
    )
    if not out or out.get("skip"):
        return False
    if out.get("maintenance"):
        raw = out.get("body") or b""
        handler.send_response(int(out.get("status") or 200))
        handler.send_header("Content-Type", "text/html; charset=utf-8")
        handler.send_header("X-Fog-Hold", "maintenance")
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.send_header("Content-Length", str(len(raw)))
        handler.end_headers()
        handler.wfile.write(raw)
        return True
    if out.get("handled") and out.get("via") and out.get("via") != HOP:
        raw = out.get("body") or b""
        handler.send_response(int(out.get("status") or 200))
        ct = (out.get("headers") or {}).get("Content-Type") or (out.get("headers") or {}).get("content-type") or "application/json"
        handler.send_header("Content-Type", ct)
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.send_header("X-Fog-Via", str(out.get("via")))
        handler.send_header("Content-Length", str(len(raw)))
        handler.end_headers()
        handler.wfile.write(raw)
        return True
    return False


def _metabol_pace(hop="python"):
    """This hop's own pace. Local py has no CF daily clock. Never 503 login on CF STASIS."""
    try:
        import sys
        path = _src_path()
        lib = os.path.abspath(os.path.join(path, "..", "ops", "lib"))
        if lib not in sys.path:
            sys.path.insert(0, lib)
        import metabolism as met
        cap = _cap()
        return met.metabol_pace(hop, host_over=bool(cap.get("over")), is_p0=True, path="/api/auth/login")
    except Exception as e:
        return {
            "ok": True,
            "hop": hop,
            "decision": "ALLOW",
            "cf_daily": False,
            "freeze": False,
            "http_503": False,
            "reason": "pace fail-open %s" % type(e).__name__,
        }


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
            "hop": "FOG:8787 MESH/IPC workerd:8788 python:8790 node:8791 deno:8792",
            "mesh": MESH,
            "public": {"fog": FOG_PUB, "edge": EDGE},
            "loopback": {"workerd": WORKERD, "fog": FOG, "py": f"http://127.0.0.1:{PORT}", "node": NODE, "deno": DENO},
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
        pace = _metabol_pace("python")
        return {
            "ok": True,
            "hop": HOP,
            "metabol_pace": pace,
            "via": WORKERD + "/metabol",
            "snap": _j(WORKERD + "/metabol"),
            "note": "per-hop pace; local py has no CF daily clock; HOLD/STASIS is pace not 503",
        }
    if kind == "mesh":
        return {
            "ok": True,
            "runtime": "python",
            "port": PORT,
            "mesh": MESH,
            "metabol_pace": _metabol_pace("python"),
            "tunnel": {"auth/mw": "127.0.0.1:8790", "fog/origin/gossip": "127.0.0.1:8788", "reload": "SIGHUP"},
        }
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



ORIGIN_ORCH = "https://calhegasmorais.pt/api/orchestrator/chat"


def handle_orch_chat(method, body):
    """POST/GET /api/orchestrator/chat — accept wizard reports locally; fail-open to origin. Never secrets."""
    body = body if isinstance(body, dict) else {}
    headline = str(body.get("headline") or body.get("message") or body.get("text") or "")[:160]
    origin = {"forwarded": False}
    if method == "POST":
        try:
            raw = json.dumps(body).encode()
            req = Request(
                ORIGIN_ORCH,
                data=raw,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "fog-mw-py/orch",
                },
            )
            with urlopen(req, timeout=4.0) as r:
                txt = r.read().decode() or "{}"
                try:
                    obj = json.loads(txt)
                except Exception:
                    obj = {}
                origin = {
                    "forwarded": True,
                    "http": int(getattr(r, "status", 200) or 200),
                    "version": (obj or {}).get("version"),
                    "ok": True,
                }
        except Exception as e:
            origin = {"forwarded": False, "fail_open": True, "error": type(e).__name__}
    return 200, {
        "ok": True,
        "hop": HOP,
        "role": "orchestrator-chat",
        "accepted": True,
        "dest": "AIOps Dev Team via Orchestrator",
        "headline": headline,
        "origin": origin,
        "methods": ["GET", "POST", "OPTIONS"],
        "version": "fog-mw-orch-chat-1",
        "service": "stratamesh-orchestrator",
        "status": "ok",
    }


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
        raw = getattr(self, "_cached_body", None)
        if raw is None:
            n = int(self.headers.get("Content-Length") or self.headers.get("content-length") or 0)
            raw = self.rfile.read(n) if n else b"{}"
            self._cached_body = raw
        try:
            return json.loads((raw or b"{}").decode() or "{}")
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
                "stasis_503": False,
                "metabol_pace": "host_cap only",
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

    def _wb(self):
        path = self.path.split("?", 1)[0]
        method = self.command
        if path.rstrip("/").endswith("/health"):
            return self._send(200, {
                "ok": True,
                "success": True,
                "hop": HOP,
                "role": "wb-memory",
                "n": 2,
                "kv": False,
            })
        hdr = self.headers.get("Authorization") or self.headers.get("authorization") or ""
        token = hdr.split(" ", 1)[-1] if hdr else ""
        rec = SESS.get(token)
        if not rec or rec["exp"] <= time.time():
            return self._send(401, {"ok": False, "error": "no_session", "hop": HOP})
        if method in ("POST", "PUT"):
            body = self._body()
            nfts = body.get("nfts") if isinstance(body.get("nfts"), list) else []
            WB[token] = {
                "nfts": nfts,
                "avatarId": body.get("avatarId"),
                "at": time.time(),
                "email": rec["email"],
            }
            return self._send(200, {
                "ok": True,
                "success": True,
                "hop": HOP,
                "saved": True,
                "count": len(nfts),
            })
        snap = WB.get(token) or {"nfts": [], "avatarId": None}
        return self._send(200, {"ok": True, "success": True, "hop": HOP, **snap})

    def do_OPTIONS(self):
        self._cors(204)
        self.end_headers()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        n = int(self.headers.get("Content-Length") or self.headers.get("content-length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        self._cached_body = raw
        if _chain_dispatch(self, path, "POST", raw):
            return
        if path.startswith("/api/auth"):
            return self._auth()
        if path.startswith("/api/wb"):
            return self._wb()
        if path.rstrip("/") in (
            "/api/orchestrator/chat",
            "/api/orchestrator/health",
            "/api/v1/orchestrator/chat",
            "/api/v1/orchestrator/health",
            "/orchestrator/chat",
        ):
            code, obj = handle_orch_chat("POST", self._body())
            return self._send(code, obj)
        if path.startswith("/object"):
            code, obj = handle_object("POST", path, self._body())
            return self._send(code, obj)
        self._send(404, {"ok": False, "error": "not found", "path": path, "hop": HOP})

    def do_PUT(self):
        path = self.path.split("?", 1)[0]
        n = int(self.headers.get("Content-Length") or self.headers.get("content-length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        self._cached_body = raw
        if _chain_dispatch(self, path, "PUT", raw):
            return
        if path.startswith("/api/auth"):
            return self._auth()
        if path.startswith("/api/wb"):
            return self._wb()
        if path.startswith("/object"):
            code, obj = handle_object("PUT", path, self._body())
            return self._send(code, obj)
        self._send(404, {"ok": False, "error": "not found", "path": path, "hop": HOP})

    def do_DELETE(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/auth"):
            return self._auth()
        if path.startswith("/api/wb"):
            return self._wb()
        self._send(404, {"ok": False, "error": "not found", "path": path, "hop": HOP})

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if _chain_dispatch(self, path, "GET"):
            return
        if path.startswith("/api/auth"):
            return self._auth()
        if path.startswith("/api/wb"):
            return self._wb()
        if path.rstrip("/") in (
            "/api/orchestrator/chat",
            "/api/orchestrator/health",
            "/api/v1/orchestrator/chat",
            "/api/v1/orchestrator/health",
            "/orchestrator/chat",
        ):
            code, obj = handle_orch_chat("GET", {})
            return self._send(code, obj)
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
            "/mesh": "mesh",
            "/mw/mesh": "mesh",
            "/fallback": "fallback",
            "/mw/fallback": "fallback",
            "/strata": "strata",
            "/mw/strata": "strata",
            "/assemble": "cmn",
            "/mw/assemble": "cmn",
            "/atelier": "cmn",
            "/mw/atelier": "cmn",
            "/dashboard": "cmn",
            "/desk": "cmn",
            "/mw/dashboard": "cmn",
        }
        kind = table.get(path)
        if not kind:
            if path.startswith("/object"):
                code, obj = handle_object("GET", path, {})
                self._send(code, obj)
                return
            self._send(404, {"ok": False, "error": "not found", "path": path})
            return
        self._send(200, payload(kind))


def main():
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()


if __name__ == "__main__":
    main()
