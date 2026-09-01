#!/usr/bin/env python3
"""Cursor API probe. Vault ~/.config/stratamesh/cursor.api — never prints the key."""
from __future__ import annotations
import json, os, urllib.request
from pathlib import Path
from urllib.error import HTTPError

def key():
    if os.environ.get("CURSOR_API_KEY"):
        return os.environ["CURSOR_API_KEY"].strip()
    p = Path.home() / ".config/stratamesh/cursor.api"
    return p.read_text().strip() if p.is_file() else None

def main():
    k = key()
    if not k:
        print(json.dumps({"ok": False, "error": "no cursor.api in vault"})); return
    req = urllib.request.Request(
        "https://api.cursor.com/v1/me",
        headers={"Authorization": "Bearer " + k, "User-Agent": "cmn-cursor"},
    )
    try:
        r = urllib.request.urlopen(req, timeout=15)
        print(json.dumps({"ok": True, "plan": "usable", "status": r.status, "body": json.loads(r.read().decode())}))
    except HTTPError as e:
        body = e.read().decode()[:400]
        plan_free = "plan_required" in body or "free users" in body.lower()
        print(json.dumps({
            "ok": not plan_free,
            "http": e.code,
            "plan": "free" if plan_free else "unknown",
            "stasis": "HOLD" if plan_free else "FAIL",
            "note": "Cloud Agent API is Pro+. Free keeps the key in vault for CLI/docs only.",
        }))

if __name__ == "__main__":
    main()
