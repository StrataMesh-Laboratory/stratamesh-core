#!/usr/bin/env python3
"""CMN SPA Python fallback — complementary to Node :8791 and workerd :8788. No KV."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
from pathlib import Path

ROOT = Path(os.environ.get("FOG_SRC", ".")) / "frontend"
PORT = int(os.environ.get("SPA_PY_PORT") or os.environ.get("PY_PORT") or 8790)
MAP = {"/": "index.html", "/dashboard": "portal-pt.html", "/login": "portal-pt.html",
       "/hold": "maintenance-1xxx.html"}

class H(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        rel = MAP.get(path.split("?",1)[0], path.lstrip("/"))
        fp = (ROOT / rel).resolve()
        if str(fp).startswith(str(ROOT.resolve())) and fp.is_file():
            return str(fp)
        hold = ROOT / "maintenance-1xxx.html"
        return str(hold if hold.is_file() else ROOT / "index.html")
    def log_message(self, fmt, *args):
        print("cmn-spa-python", fmt % args)

if __name__ == "__main__":
    os.chdir(ROOT if ROOT.is_dir() else ".")
    print("cmn-spa-python", PORT, ROOT)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
