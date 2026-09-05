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
        "version": "0.6.0-lab",
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

    def _html(self, code, body: str):
        raw = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _page(self) -> str:
        p = payload()
        mp = p.get("mesh_provision") or {}
        return f"""<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>EDGE-GROK-CMN-001 · v{p.get("version")}</title>
<style>
:root {{ --bg:#0a0a0b; --fg:#e8e6e3; --muted:#8a8780; --line:#1c1c1f; --acc:#c4a574; }}
body {{ margin:0; font:16px/1.45 system-ui,sans-serif; background:var(--bg); color:var(--fg); }}
main {{ max-width:40rem; margin:0 auto; padding:2.5rem 1.25rem 4rem; }}
h1 {{ font-size:1.25rem; font-weight:600; }}
p,li {{ color:var(--muted); }}
a {{ color:var(--acc); }}
code {{ color:var(--fg); }}
.badge {{ display:inline-block; border:1px solid var(--line); padding:.15rem .5rem; font-size:.75rem; letter-spacing:.04em; }}
</style>
</head>
<body>
<main>
<p class="badge">LAB · prerelease · not mainnet</p>
<h1>EDGE-GROK-CMN-001</h1>
<p>v<code>{p.get("version")}</code> · origin=<code>edge</code> · n={p.get("n")} · mesh_member={str(p.get("mesh_member")).lower()} · f_max={mp.get("f_max", 0)}</p>
<p>Continuity=<code>session</code> (expected). Linked Fog <code>FOG-NODE-PT-CM-001</code>. Distinct host from the Mac. <code>oracle_live=false</code>.</p>
<ul>
<li><a href="/health">/health</a> JSON</li>
<li><a href="https://fog.calhegasmorais.pt/health">Fog /health</a> JSON</li>
<li><a href="https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.6.0-lab">tag v0.6.0-lab</a></li>
</ul>
</main>
</body></html>
"""

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        accept = self.headers.get("Accept") or ""
        if path in ("/", "/health", "/status"):
            if path == "/" and "text/html" in accept:
                self._html(200, self._page())
                return
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
