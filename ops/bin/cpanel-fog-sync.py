#!/usr/bin/env python3
"""Fog-side cPanel UAPI probe. Token from secrets.env — never stdout."""
from __future__ import annotations
import json, os, ssl, sys, urllib.request
from pathlib import Path

HOST = os.environ.get("CPANEL_HOST", "94.126.169.39")
PORT = os.environ.get("CPANEL_PORT", "2083")
USER = os.environ.get("CPANEL_USER", "")

def token():
    if os.environ.get("CPANEL_TOKEN"):
        return os.environ["CPANEL_TOKEN"]
    for p in (Path.home() / ".config/stratamesh/secrets.env", Path.home() / ".config/stratagrok/secrets.env"):
        if not p.is_file():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if line.startswith("CPANEL_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

def uapi(mod, fn, params=None):
    tok = token()
    if not tok:
        return {"ok": False, "error": "no CPANEL_TOKEN in env or ~/.config/stratamesh/secrets.env"}
    q = "&".join(f"{k}={v}" for k, v in (params or {}).items())
    url = f"https://{HOST}:{PORT}/execute/{mod}/{fn}" + (("?" + q) if q else "")
    req = urllib.request.Request(url, headers={"Authorization": "cpanel " + (USER + ":" + tok if USER else tok), "User-Agent": "cmn-fog-cpanel"})
    # some tokens use Bearer
    try:
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
            return {"ok": True, "status": r.status, "data": json.loads(r.read().decode())}
    except Exception as e:
        req2 = urllib.request.Request(url, headers={"Authorization": "Bearer " + tok, "User-Agent": "cmn-fog-cpanel"})
        try:
            ctx = ssl._create_unverified_context()
            with urllib.request.urlopen(req2, context=ctx, timeout=20) as r:
                return {"ok": True, "status": r.status, "auth": "bearer", "data": json.loads(r.read().decode())}
        except Exception as e2:
            return {"ok": False, "error": str(e2)}

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "health"
    if cmd == "health":
        print(json.dumps({"hop": "cpanel-uapi", "host": HOST, "has_token": bool(token())}))
        return
    if cmd == "list-db":
        print(json.dumps(uapi("Mysql", "list_databases"), indent=2)[:2000])
        return
    if cmd == "list-dns":
        print(json.dumps(uapi("DNS", "parse_zone", {"zone": "calhegasmorais.pt"}), indent=2)[:2000])
        return
    print("usage: cpanel-fog-sync.py health|list-db|list-dns")

if __name__ == "__main__":
    main()
