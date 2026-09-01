#!/usr/bin/env python3
"""Live metabolic stasis: GraphQL Workers spend vs rails.json cap. No KV writes."""
import json, os, sys, urllib.request
from datetime import datetime, timezone

ACCT = os.environ.get("CF_ACCOUNT_ID", "f3645fcb56675cf7250d8ba7358eb252")
TOKEN = os.environ.get("GOD_API") or os.environ.get("CF_API_TOKEN")
EMAIL = os.environ.get("CLOUDFLARE_EMAIL", "amcmorais@icloud.com")
DAY_CAP = int(os.environ.get("CF_WORKER_DAY_CAP", "100000"))

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
    return max(left, 0.25)

def main():
    if not TOKEN:
        print("no GOD_API", file=sys.stderr)
        sys.exit(2)
    spent, top = gql_day_spent()
    remain = max(DAY_CAP - spent, 0)
    h = hours_left()
    cap = remain / h
    hour_guess = spent / max(datetime.now(timezone.utc).hour, 1)
    circuit = "ALLOW"
    if spent >= DAY_CAP:
        circuit = "STASIS"
    elif hour_guess >= 2 * max(cap, 1):
        circuit = "STASIS"
    elif hour_guess >= 1.25 * max(cap, 1):
        circuit = "HOLD"
    state = {
        "circuit": circuit,
        "day_spent": spent,
        "day_cap": DAY_CAP,
        "remaining": remain,
        "hours_until_renewal_utc": round(h, 2),
        "hourly_cap": round(cap, 1),
        "renewal": "00:00 UTC",
        "top": [{"script": n, "requests": s} for s, n in top],
        "html_hop": "pages",
        "catch_all_spa": False,
    }
    print(json.dumps(state, indent=2))
    open("stasis-state.json", "w").write(json.dumps(state, indent=2))
    if circuit == "STASIS":
        sys.exit(1)

if __name__ == "__main__":
    main()
