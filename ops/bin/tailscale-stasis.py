#!/usr/bin/env python3
"""Tailscale API stasis: vault key + rails.json daily_limit. Never prints secrets."""
from __future__ import annotations
import json, os, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

VAULT = Path.home() / ".config" / "stratamesh"
DAY = 2000

def api_key():
    if os.environ.get("TAILSCALE_API_KEY"):
        return os.environ["TAILSCALE_API_KEY"].strip()
    p = VAULT / "tailscale.api"
    return p.read_text().strip() if p.is_file() else None

def ledger():
    p = Path("/tmp/metab/tailscale-ledger.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.is_file():
        try:
            return json.loads(p.read_text()), p
        except Exception:
            pass
    return {"day": None, "calls": 0}, p

def main():
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    led, path = ledger()
    if led.get("day") != day:
        led = {"day": day, "calls": 0}
    left = max(DAY - int(led.get("calls") or 0), 0)
    hours = max(24 - now.hour, 1)
    cap = left / hours
    state = "STASIS" if left <= 0 else ("HOLD" if cap < 2 else "ALLOW")
    key = api_key()
    live = {"reachable": False}
    if key and state != "STASIS":
        req = urllib.request.Request(
            "https://api.tailscale.com/api/v2/tailnet/-/devices",
            headers={"Authorization": "Bearer " + key, "User-Agent": "cmn-ts-stasis"},
        )
        try:
            r = urllib.request.urlopen(req, timeout=15)
            n = len((json.loads(r.read().decode()).get("devices") or []))
            live = {"reachable": True, "devices": n}
            led["calls"] = int(led.get("calls") or 0) + 1
        except Exception as e:
            live = {"reachable": False, "error": str(e)[:120]}
            if "429" in str(e):
                state = "STASIS"
    path.write_text(json.dumps(led))
    print(json.dumps({
        "rail": "tailscale-api",
        "state": state,
        "day": day,
        "calls": led.get("calls"),
        "daily_limit": DAY,
        "hourly_cap": round(cap, 3),
        "has_api_key": bool(key),
        "has_auth_key": (VAULT / "tailscale.authkey").is_file(),
        "live": live,
    }))

if __name__ == "__main__":
    main()
