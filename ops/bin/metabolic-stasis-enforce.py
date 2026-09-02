#!/usr/bin/env python3
"""Live metabolic pace: GraphQL Workers spend vs rails.json cap.

Freeze is admit() after pace fail, not a Worker env binding.
NEVER PATCH Worker env STASIS=1. Live auth 2.10.5-turnstile-lab uses that
binding as a different freeze; do not overwrite it from this job.

STASIS on the circuit is min pace (deflate). sys.exit(1) only when freeze
(pace already failed AND no healthy contingency). First STASIS exits 0 so
the 3h job does not treat pacing as an outage.
No 6th CF cron. Never workers.dev. No secrets in output.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ACCT = os.environ.get("CF_ACCOUNT_ID", "f3645fcb56675cf7250d8ba7358eb252")
TOKEN = os.environ.get("GOD_API") or os.environ.get("CF_API_TOKEN")
EMAIL = os.environ.get("CLOUDFLARE_EMAIL", "amcmorais@icloud.com")
DAY_CAP = int(os.environ.get("CF_WORKER_DAY_CAP", "100000"))
D1_ID = os.environ.get("D1_LEDGER_ID") or "f78ff995-03d2-4b97-88b6-56e61416fce7"
STATE_PATH = Path(os.environ.get("STASIS_STATE", "stasis-state.json"))

# Named fail-open hops (not Worker SPA / not workers.dev).
CONTINGENCY = {
    "auth": "https://auth.calhegasmorais.pt",
    "apex_html": "https://calhegasmorais.pt/",
    "sandbox": "https://sandbox.calhegasmorais.pt/",
}


def gql_day_spent():
    q = {
      "query": (
        "query { viewer { accounts(filter: {accountTag: \"%s\"}) { "
        "workersInvocationsAdaptive(limit: 50, filter: {datetime_geq: \"%s\"}) "
        "{ sum { requests } dimensions { scriptName } } } } }"
      ) % (ACCT, datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00Z"))
    }
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql",
        data=json.dumps(q).encode(),
        headers={
            "Authorization": "Bearer " + TOKEN,
            "X-Auth-Email": EMAIL,
            "Content-Type": "application/json",
            "User-Agent": "cmn-stasis",
        },
    )
    data = json.loads(urllib.request.urlopen(req, timeout=30).read())
    rows = data["data"]["viewer"]["accounts"][0]["workersInvocationsAdaptive"]
    spent = sum(r["sum"]["requests"] for r in rows)
    top = sorted(((r["sum"]["requests"], r["dimensions"]["scriptName"]) for r in rows), reverse=True)[:8]
    return spent, top


def hours_left():
    now = datetime.now(timezone.utc)
    left = 24 - now.hour - now.minute / 60.0
    return max(left, 1.0 / 60.0)


def pace_factor(day_spent, daily_limit, hours_until, window_hours=24.0, lo=0.5, hi=1.5):
    if float(day_spent) <= 0 or float(daily_limit) <= 0:
        return 1.0
    elapsed = max(float(window_hours) - float(hours_until), 1.0 / 60.0)
    window = max(float(window_hours), elapsed)
    spent_frac = float(day_spent) / float(daily_limit)
    time_frac = elapsed / window
    if spent_frac < 1e-12:
        return 1.0
    return max(lo, min(hi, time_frac / spent_frac))


def pace_failed(prev_circuit, circuit, hour_spent, hourly_cap):
    if str(circuit or "") != "STASIS":
        return False
    if str(prev_circuit or "") not in ("HOLD", "STASIS"):
        return False
    return float(hour_spent) >= 2.0 * max(float(hourly_cap), 1e-9)


def load_prev():
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def d1_upsert_snapshot(state: dict) -> str:
    """Reuse LEDGER site_content_chunks (same table as d1-put-html). No new schema."""
    if not TOKEN:
        return "skip_no_token"
    payload = {
        "sql": "INSERT OR REPLACE INTO site_content_chunks (key, idx, value) VALUES (?, ?, ?)",
        "params": ["metabol_snapshot", 0, json.dumps(state)],
    }
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{D1_ID}/query",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": "Bearer " + TOKEN,
            "X-Auth-Email": EMAIL,
            "Content-Type": "application/json",
            "User-Agent": "cmn-stasis",
        },
    )
    try:
        d = json.loads(urllib.request.urlopen(req, timeout=30).read())
        if d.get("success"):
            return "ok"
        return "d1_error"
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return "d1_error"


def main():
    if not TOKEN:
        print("no GOD_API", file=sys.stderr)
        sys.exit(2)
    spent, top = gql_day_spent()
    remain = max(DAY_CAP - spent, 0)  # live remaining; do not invent
    h = hours_left()
    cap = remain / h
    now = datetime.now(timezone.utc)
    hour_guess = spent / max(now.hour, 1)
    pf = pace_factor(spent, DAY_CAP, h)
    circuit = "ALLOW"
    if spent >= DAY_CAP:
        circuit = "STASIS"
    elif hour_guess >= 2 * max(cap, 1):
        circuit = "STASIS"
    elif hour_guess >= 1.25 * max(cap, 1):
        circuit = "HOLD"

    prev = load_prev()
    prev_circuit = prev.get("circuit") or "ALLOW"
    failed = pace_failed(prev_circuit, circuit, hour_guess, cap)

    # Contingency routes are named and configured for this lab.
    env_ok = os.environ.get("CONTINGENCY_OK", "1") != "0"
    c_url = CONTINGENCY["auth"]
    c_ok = env_ok and bool(c_url)

    freeze = False
    via = "primary"
    if circuit == "STASIS" and remain <= 0 and not c_ok:
        freeze = True
    elif failed and not c_ok:
        freeze = True
    elif failed and c_ok:
        via = "contingency"

    state = {
        "circuit": circuit,
        "day_spent": spent,
        "day_cap": DAY_CAP,
        "remaining": remain,
        "hours_until_renewal_utc": round(h, 2),
        "hourly_cap": round(cap, 1),
        "hour_guess": round(hour_guess, 1),
        "pace_factor": round(pf, 4),
        "deflator": round(min(1.0, pf), 4),
        "inflator": round(max(1.0, pf), 4),
        "prev_circuit": prev_circuit,
        "pace_failed": failed,
        "freeze": freeze,
        "via": via,
        "contingency_url": c_url,
        "contingency_ok": c_ok,
        "contingency": CONTINGENCY,
        "renewal": "00:00 UTC",
        "top": [{"script": n, "requests": s} for s, n in top],
        "html_hop": "pages",
        "catch_all_spa": False,
        "note": "freeze is admit() after pace fail, not a binding; never PATCH env STASIS=1",
    }
    print(json.dumps(state, indent=2))
    STATE_PATH.write_text(json.dumps(state, indent=2))
    snap = d1_upsert_snapshot(state)
    print(json.dumps({"d1_metabol_snapshot": snap, "d1_id": D1_ID}), file=sys.stderr)
    if freeze:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
