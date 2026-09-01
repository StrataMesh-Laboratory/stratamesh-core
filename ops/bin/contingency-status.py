#!/usr/bin/env python3
"""Print contingency layer health. No secrets."""
import json, urllib.request
from urllib.error import URLError, HTTPError

LAYERS = [
    ("pages", "https://calhegasmorais.pt/"),
    ("python", "http://127.0.0.1:8790/health"),
    ("node", "http://127.0.0.1:8791/health"),
    ("workerd", "http://127.0.0.1:8788/health"),
    ("fog", "http://127.0.0.1:8787/health"),
]

def probe(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "cmn-contingency"}), timeout=5)
        return r.status, (r.read()[:80].decode("utf-8", "replace").replace("\n", " "))
    except HTTPError as e:
        return e.code, e.read()[:60].decode("utf-8", "replace")
    except Exception as e:
        return 0, type(e).__name__

if __name__ == "__main__":
    out = []
    for name, url in LAYERS:
        code, body = probe(url)
        out.append({"layer": name, "http": code, "head": body})
    print(json.dumps({"ok": True, "layers": out}, indent=2))
