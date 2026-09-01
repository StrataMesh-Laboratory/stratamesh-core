#!/usr/bin/env python3
"""Fog-side cPanel UAPI. Reads Fog vault files — never prints secrets."""
from __future__ import annotations
import json, os, ssl, sys, urllib.request
from pathlib import Path

HOST = os.environ.get("CPANEL_HOST", "94.126.169.39")
PORT = os.environ.get("CPANEL_PORT", "2083")
USER = os.environ.get("CPANEL_USER", "")

VAULTS = [
    Path.home() / ".config" / "stratamesh",
    Path.home() / ".config" / "stratagrok",
    Path("/home/box/.config/stratamesh"),
    Path("/home/box/.config/stratagrok"),
]

TOKEN_FILES = (
    "cpanel.token",
    "cpanel_token",
    "CPANEL_TOKEN",
    "hosting.token",
    "eni.cpanel",
)

ENV_KEYS = ("CPANEL_TOKEN", "CPANEL_API_TOKEN", "CPANEL_API")


def _parse_env(p: Path) -> dict:
    out = {}
    if not p.is_file():
        return out
    for line in p.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def token():
    if os.environ.get("CPANEL_TOKEN"):
        return os.environ["CPANEL_TOKEN"], "env:CPANEL_TOKEN"
    for vault in VAULTS:
        if not vault.is_dir():
            continue
        for name in TOKEN_FILES:
            p = vault / name
            if p.is_file() and p.stat().st_size > 8:
                return p.read_text().strip(), str(p)
        for envname in ("secrets.env", ".env"):
            env = _parse_env(vault / envname)
            for k in ENV_KEYS:
                if env.get(k):
                    return env[k], f"{vault/envname}:{k}"
        # any file whose name contains cpanel
        for p in vault.iterdir():
            if p.is_file() and "cpanel" in p.name.lower() and p.stat().st_size > 8:
                return p.read_text().strip(), str(p)
    return None, None


def uapi(mod, fn, params=None):
    tok, src = token()
    if not tok:
        return {"ok": False, "error": "no cPanel token", "looked": [str(v) for v in VAULTS], "want": list(TOKEN_FILES)}
    q = "&".join(f"{k}={v}" for k, v in (params or {}).items())
    url = f"https://{HOST}:{PORT}/execute/{mod}/{fn}" + (("?" + q) if q else "")
    ctx = ssl._create_unverified_context()
    last = None
    user = USER or os.environ.get("CPANEL_USER") or ""
    headers_try = [
        {"Authorization": "Bearer " + tok, "User-Agent": "cmn-fog-cpanel"},
        {"Authorization": "cpanel " + ((user + ":" + tok) if user else tok), "User-Agent": "cmn-fog-cpanel"},
    ]
    for hdr in headers_try:
        try:
            req = urllib.request.Request(url, headers=hdr)
            with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
                return {"ok": True, "status": r.status, "data": json.loads(r.read().decode())}
        except Exception as e:
            last = str(e)
    return {"ok": False, "error": last}


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "health"
    tok, src = token()
    if cmd == "health":
        print(json.dumps({
            "hop": "cpanel-uapi",
            "host": HOST,
            "has_token": bool(tok),
            "token_locus": src,
            "vaults_exist": [str(v) for v in VAULTS if v.is_dir()],
        }))
        return
    if cmd == "list-db":
        print(json.dumps(uapi("Mysql", "list_databases"), indent=2)[:2500])
        return
    print("usage: cpanel-fog-sync.py health|list-db")

if __name__ == "__main__":
    main()
