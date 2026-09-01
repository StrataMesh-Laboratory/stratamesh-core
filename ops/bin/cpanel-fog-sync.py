#!/usr/bin/env python3
"""Fog cPanel UAPI/json-api probe. Never prints secrets."""
from __future__ import annotations
import json, os, ssl, sys, urllib.parse, urllib.request
from pathlib import Path

HOST = os.environ.get("CPANEL_HOST", "94.126.169.39")
PORT = os.environ.get("CPANEL_PORT", "2083")
USER = os.environ.get("CPANEL_USER", "calhegas")
VAULT = Path.home() / ".config" / "stratamesh"

def token():
    if os.environ.get("CPANEL_TOKEN"):
        return os.environ["CPANEL_TOKEN"].strip(), "env"
    p = VAULT / "cpanel.token"
    if p.is_file():
        return p.read_text().strip(), str(p)
    return None, None

def user():
    p = VAULT / "cpanel.user"
    if p.is_file():
        return p.read_text().strip() or USER
    return USER

def call(url, headers):
    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
        raw = r.read()
        text = raw.decode("utf-8", "replace")
        out = {"status": r.status, "ctype": r.headers.get("content-type"), "len": len(raw)}
        try:
            out["data"] = json.loads(text)
            out["ok"] = True
        except Exception:
            out["ok"] = False
            out["head"] = text[:120].replace("\n", " ")
        return out

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "health"
    tok, src = token()
    usr = user()
    if cmd == "health":
        print(json.dumps({"hop": "cpanel", "host": HOST, "user": usr, "has_token": bool(tok), "token_locus": src}))
        return
    if not tok:
        print(json.dumps({"ok": False, "error": "no token"})); return
    mod, fn = "Mysql", "list_databases"
    if cmd in ("list-mail", "mail"):
        mod, fn = "Email", "list_pops"
    urls = [
        f"https://{HOST}:{PORT}/execute/{mod}/{fn}",
        f"https://{HOST}:{PORT}/json-api/cpanel?cpanel_jsonapi_user={urllib.parse.quote(usr)}&cpanel_jsonapi_apiversion=3&cpanel_jsonapi_module={mod}&cpanel_jsonapi_func={fn}",
    ]
    basic = "Basic " + __import__("base64").b64encode((usr + ":" + tok).encode()).decode()
    auths = [
        ("basic", {"Authorization": basic, "Accept": "application/json"}),
        ("cpanel-pair", {"Authorization": f"cpanel {usr}:{tok}", "Accept": "application/json"}),
        ("bearer", {"Authorization": "Bearer " + tok, "Accept": "application/json"}),
    ]
    traces = []
    for url in urls:
        for name, hdr in auths:
            hdr = dict(hdr)
            hdr["User-Agent"] = "cmn-fog-cpanel"
            try:
                r = call(url, hdr)
            except Exception as e:
                traces.append({"auth": name, "error": str(e)[:160], "path": url.split(HOST)[-1][:80]})
                continue
            r["auth"] = name
            r["path"] = url.split(str(PORT))[-1][:90]
            if r.get("ok"):
                print(json.dumps(r, indent=2)[:2500])
                return
            traces.append({k: r[k] for k in r if k != "data"})
    print(json.dumps({"ok": False, "error": "html-login-not-uapi", "user": usr, "trace": traces}, indent=2)[:2500])

if __name__ == "__main__":
    main()
