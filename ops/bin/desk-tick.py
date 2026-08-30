#!/usr/bin/env python3
"""EDGE-GROK desk tick — observe only. Public GitHub Actions body.

Probes coalesced /health (never status-worker /status, never workers.dev).
Optional CF GraphQL remaining when GOD_API is set. Honesty canary on Fog.
Comment #52 only on FAIL. Never a 6th cron. Never publish from this script.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ZONE = "calhegasmorais.pt"
ROOT = Path(__file__).resolve().parents[2]


def _load_probes() -> dict[str, Any]:
    p = ROOT / "ops/config/health-probes.json"
    if p.is_file():
        return json.loads(p.read_text())
    return {}


_PROBES = _load_probes()
CORE_HEALTH = set(_PROBES.get("core") or [
    f"https://status.{ZONE}/health",
    f"https://fog.{ZONE}/health",
    f"https://gossip.{ZONE}/health",
    f"https://edge.{ZONE}/health",
])
HEALTH = list(_PROBES.get("health") or [
    f"https://{ZONE}/",
    f"https://status.{ZONE}/health",
    f"https://fog.{ZONE}/health",
    f"https://gossip.{ZONE}/health",
    f"https://origin.{ZONE}/",
    f"https://edge.{ZONE}/health",
    f"https://fund.{ZONE}/health",
])
FOG_STATUS = _PROBES.get("fog_status") or f"https://fog.{ZONE}/status"
UA = _PROBES.get("ua") or "StrataMesh-DeskTick/1.1 (+https://github.com/StrataMesh-Laboratory/stratamesh-core)"
# EDGE hop is session (non-continuous). 530 origin-down / 429 CF 1015 are expected, not Fog P0.
SESSION_EXPECTED_HTTP = {
    str(k): {int(x) for x in (v or [])}
    for k, v in (_PROBES.get("session_expected_http") or {
        f"https://edge.{ZONE}/health": [429, 530],
    }).items()
}
CF_ACCOUNT = os.environ.get("CF_ACCOUNT") or "f3645fcb56675cf7250d8ba7358eb252"
CF_DAILY = 100_000


def _secret(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if v:
        return v
    for p in (f"/tmp/{name.lower()}", "/tmp/god_api", "/tmp/gh_pat"):
        fp = Path(p)
        if fp.is_file() and name.lower() in p:
            return fp.read_text().strip()
    if name in ("GOD_API", "CLOUDFLARE_API_TOKEN") and Path("/tmp/god_api").is_file():
        return Path("/tmp/god_api").read_text().strip()
    return ""


def fetch(url: str, timeout: int = 15, accept: str = "*/*") -> dict[str, Any]:
    low = url.lower()
    if "workers.dev" in low:
        return {"url": url, "ok": False, "error": "STASIS workers.dev forbidden", "http": 0}
    if low.rstrip("/").endswith("status.calhegasmorais.pt/status"):
        return {"url": url, "ok": False, "error": "never status-worker /status", "http": 0}
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": accept},
        method="GET",
    )
    t0 = datetime.now(timezone.utc)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            dt = (datetime.now(timezone.utc) - t0).total_seconds()
            ct = r.headers.get("Content-Type") or ""
            body: Any
            try:
                body = json.loads(raw.decode() or "{}")
            except Exception:
                body = {"_text": raw[:240].decode("utf-8", "replace")}
            return {
                "url": url,
                "ok": 200 <= r.status < 400,
                "http": r.status,
                "ms": int(dt * 1000),
                "ct": ct,
                "body": body,
            }
    except urllib.error.HTTPError as e:
        return {"url": url, "ok": False, "http": e.code, "error": str(e.reason), "ms": 0}
    except Exception as e:
        return {"url": url, "ok": False, "http": 0, "error": f"{type(e).__name__}: {e}", "ms": 0}


def cf_graphql(email: str, token: str) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    hour = now.replace(minute=0, second=0, microsecond=0)
    payload = {
        "query": """
          query ($accountTag: String!, $dayFrom: Time!, $hourFrom: Time!, $to: Time!) {
            viewer { accounts(filter: { accountTag: $accountTag }) {
              day: workersInvocationsAdaptive(
                limit: 1
                filter: { datetime_geq: $dayFrom, datetime_lt: $to }
              ) { sum { requests } }
              hour: workersInvocationsAdaptive(
                limit: 1
                filter: { datetime_geq: $hourFrom, datetime_lt: $to }
              ) { sum { requests } }
            } }
          }
        """,
        "variables": {
            "accountTag": CF_ACCOUNT,
            "dayFrom": day.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "hourFrom": hour.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "to": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
    }
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "X-Auth-Email": email,
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}
    if data.get("errors") or not data.get("data"):
        return {"error": data.get("errors") or "no data"}
    try:
        acct = data["data"]["viewer"]["accounts"][0]

        def _sum(key: str) -> int:
            rows = acct.get(key) or [{}]
            return int(((rows[0] or {}).get("sum") or {}).get("requests") or 0)

        used = _sum("day")
        hour_spent = _sum("hour")
        remaining = max(0, CF_DAILY - used)
        hours_left = max((24 - now.hour - now.minute / 60.0), 1.0 / 60.0)
        hourly_cap = remaining / hours_left
        return {
            "used": used,
            "hour_spent": hour_spent,
            "remaining": remaining,
            "hours_left": round(hours_left, 3),
            "hourly_cap": round(hourly_cap, 2),
            "circuit_hold": hour_spent >= 1.25 * hourly_cap,
            "circuit_stasis": hour_spent >= 2.0 * hourly_cap,
        }
    except Exception as e:
        return {"error": f"parse: {e}"}


def honesty(fog_status: dict[str, Any]) -> list[str]:
    fails: list[str] = []
    body = fog_status.get("body") if isinstance(fog_status.get("body"), dict) else {}
    if not fog_status.get("ok"):
        fails.append("fog /status not 200 (tunnel/Fog process)")
        return fails
    n = body.get("n")
    if body.get("mesh_member") is True and (n is None or int(n) < 2):
        fails.append("honesty: mesh_member true while n<2")
    prov = body.get("mesh_provision") if isinstance(body.get("mesh_provision"), dict) else {}
    if prov.get("mesh_member") is True and int(prov.get("n") or n or 0) < 2:
        fails.append("honesty: mesh_provision.mesh_member true while n<2")
    if body.get("oracle_live") is True:
        fails.append("honesty: oracle_live true")
    ver = str(body.get("version") or "")
    if ver and not (str(ver).startswith("0.2.3") or str(ver).startswith("0.3.")): 
        fails.append(f"honesty: Fog version {ver!r} not 0.2.3*/0.3.*")
    return fails


def markdown(report: dict[str, Any]) -> str:
    lines = [
        f"# desk-tick {report['at']}",
        "",
        f"ok={report['ok']}  fails={len(report['fails'])}  probes={report['ok_probes']}/{report['n_probes']}",
        "",
        "| URL | HTTP | ms | note |",
        "|---|---:|---:|---|",
    ]
    for p in report["probes"]:
        note = p.get("error") or (
            (p.get("body") or {}).get("version")
            if isinstance(p.get("body"), dict)
            else ""
        )
        if p.get("session_expected"):
            note = f"session-expected http={p.get('http')} (EDGE hop, not Fog P0)"
        lines.append(f"| `{p['url']}` | {p.get('http', 0)} | {p.get('ms', 0)} | {note} |")
    metab = report.get("metabolism")
    if metab:
        lines += ["", "## cf-worker-req", f"```json\n{json.dumps(metab, indent=2)}\n```"]
    if report["fails"]:
        lines += ["", "## FAIL", *[f"- {f}" for f in report["fails"]]]
    else:
        lines += ["", "Honesty canary green. No publish from this tick."]
    return "\n".join(lines) + "\n"


def main() -> int:
    now = datetime.now(timezone.utc)
    probes = [fetch(u) for u in HEALTH]
    fog = fetch(FOG_STATUS, accept="application/json")
    fails = honesty(fog)
    for p in probes:
        if "workers.dev" in (p.get("url") or "").lower():
            fails.append(f"workers.dev {p['url']}")
        if not p.get("ok") and p["url"] in CORE_HEALTH:
            allowed = SESSION_EXPECTED_HTTP.get(p["url"]) or set()
            if int(p.get("http") or 0) in allowed:
                p["session_expected"] = True
                continue
            fails.append(f"health down {p['url']} http={p.get('http')} {p.get('error') or ''}")

    email = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"
    token = _secret("GOD_API") or _secret("CLOUDFLARE_API_TOKEN")
    metab = cf_graphql(email, token) if token else {"skipped": "no GOD_API"}
    if isinstance(metab, dict) and metab.get("circuit_stasis"):
        fails.append("cf-worker-req STASIS 2× hourly cap")
    elif isinstance(metab, dict) and metab.get("circuit_hold"):
        fails.append("cf-worker-req HOLD 1.25× hourly cap")

    ok_probes = sum(1 for p in probes if p.get("ok"))
    report = {
        "schema": "stratamesh.desk-tick.v1",
        "at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ok": not fails,
        "fails": fails,
        "n_probes": len(probes),
        "ok_probes": ok_probes,
        "probes": probes,
        "fog_status": {
            "http": fog.get("http"),
            "version": (fog.get("body") or {}).get("version") if isinstance(fog.get("body"), dict) else None,
            "mesh_member": (fog.get("body") or {}).get("mesh_member") if isinstance(fog.get("body"), dict) else None,
            "oracle_live": (fog.get("body") or {}).get("oracle_live") if isinstance(fog.get("body"), dict) else None,
        },
        "metabolism": metab,
        "never_workers_dev": True,
        "no_sixth_cron": True,
        "no_publish": True,
        "session_expected": [
            {"url": p["url"], "http": p.get("http")}
            for p in probes
            if p.get("session_expected")
        ],
    }

    md = markdown(report)
    out_dir = Path(os.environ.get("DESK_TICK_OUT") or "/tmp/desk-tick")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "desk-tick.json").write_text(json.dumps(report, indent=2, default=str))
    (out_dir / "desk-tick.md").write_text(md)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(md)
    sys.stdout.write(md)

    if fails:
        print("DESK-TICK FAIL: " + " | ".join(fails), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
