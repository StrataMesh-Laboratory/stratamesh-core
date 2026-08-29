#!/usr/bin/env python3
"""Live CF Worker inventory. Fail if scheduled triggers > 5. Observe only."""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

CF_ACCOUNT = os.environ.get("CF_ACCOUNT") or "f3645fcb56675cf7250d8ba7358eb252"
EMAIL = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"
HARD = 5


def token() -> str:
    t = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not t and Path("/tmp/god_api").is_file():
        t = Path("/tmp/god_api").read_text().strip()
    return t


def cf(tok: str, path: str) -> dict:
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4" + path,
        headers={"X-Auth-Email": EMAIL, "Authorization": "Bearer " + tok},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main() -> int:
    require = "--require-token" in sys.argv
    tok = token()
    if not tok:
        print("worker-inventory: no GOD_API", file=sys.stderr)
        return 2 if require else 0
    scripts = cf(tok, f"/accounts/{CF_ACCOUNT}/workers/scripts?per_page=100").get("result") or []
    crons = []
    for s in scripts:
        name = s.get("id")
        try:
            t = cf(tok, f"/accounts/{CF_ACCOUNT}/workers/scripts/{name}/schedules")
        except Exception:
            continue
        result = t.get("result")
        schedules = []
        if isinstance(result, dict):
            schedules = result.get("schedules") or []
        elif isinstance(result, list):
            schedules = result
        for sch in schedules:
            cron = sch.get("cron") if isinstance(sch, dict) else None
            if cron:
                crons.append({"script": name, "cron": cron})
    n_scripts = len(scripts)
    n_cron = len(crons)
    print(f"scripts {n_scripts}  crons {n_cron}/{HARD}")
    for c in crons:
        print(f"  {c['script']}  {c['cron']}")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(f"## worker-inventory\n\nscripts **{n_scripts}** · crons **{n_cron}/{HARD}**\n\n")
            for c in crons:
                fh.write(f"- `{c['script']}` `{c['cron']}`\n")
    if n_cron > HARD:
        print(f"FAIL 6th cron (or more): {n_cron} > {HARD}", file=sys.stderr)
        return 1
    if n_scripts > 100:
        print(f"FAIL published Worker cap 100: {n_scripts}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
