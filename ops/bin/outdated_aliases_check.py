#!/usr/bin/env python3
"""Scrub outdated public aliases vs HEAD mark v0.5.1-lab.

HTML Pages must carry the mark. /health JSON must not be the P0 session alias
(n=1 mesh_member=false) and must carry version/release v0.5.1-lab.
Hold HTML on academy/edge /health is outdated. Never workers.dev.
"""
import json, os, sys, urllib.request

HEAD_MARK = os.environ.get("HEAD_MARK", "v0.5.1-lab")
DEBUG = os.environ.get("DEBUG") == "1"

HTML = [
    {"url": "https://calhegasmorais.pt/", "marks": [HEAD_MARK]},
    {"url": "https://www.calhegasmorais.pt/", "marks": [HEAD_MARK]},
    {"url": "https://calhegasmorais-pt.pages.dev/", "marks": [HEAD_MARK]},
    {"url": "https://calhegasmorais.pt/dashboard", "marks": [HEAD_MARK]},
    {"url": "https://sandbox.calhegasmorais.pt/", "marks": ["v0.5.1", "Atelier GNU"]},
]

# JSON /health — n/member must not follow ORIGIN=session (outdated P0 alias).
HEALTH = [
    {"url": "https://fog.calhegasmorais.pt/health", "n": 2, "member": True, "version": HEAD_MARK},
    {"url": "https://auth.calhegasmorais.pt/health", "n": 2, "member": True, "version": HEAD_MARK},
    {"url": "https://mw.calhegasmorais.pt/health", "n": 2, "member": True, "version": HEAD_MARK},
    {"url": "http://127.0.0.1:8788/health", "n": 2, "member": True, "version": HEAD_MARK, "optional": True},
]

HOLD = "Laboratório em manutenção"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "cmn-alias-check", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.read().decode("utf-8", "replace"), r.geturl(), dict(r.headers)


def main():
    rows = []
    outdated = False
    for spec in HTML:
        url, marks = spec["url"], spec["marks"]
        try:
            status, body, final, hdrs = fetch(url)
            has = any(m in body for m in marks)
            hold = HOLD in body
            row = {"url": url, "kind": "html", "status": status, "final": final, "has_mark": has, "hold_html": hold, "bytes": len(body), "cache": hdrs.get("cf-cache-status") or hdrs.get("CF-Cache-Status")}
            if hold or status >= 400 or not has:
                outdated = True
                row["outdated"] = True
        except Exception as e:
            outdated = True
            row = {"url": url, "kind": "html", "error": str(e)[:160], "outdated": True}
        rows.append(row)
        print(json.dumps(row))

    for spec in HEALTH:
        url = spec["url"]
        optional = spec.get("optional")
        try:
            status, body, final, hdrs = fetch(url)
            if HOLD in body or body.lstrip().startswith("<"):
                row = {"url": url, "kind": "health", "status": status, "outdated": True, "reason": "hold_html_or_not_json"}
                outdated = True
            else:
                data = json.loads(body)
                ver = str(data.get("version") or data.get("release") or "")
                n = data.get("n")
                member = data.get("mesh_member")
                ok_ver = HEAD_MARK in ver or ver in (HEAD_MARK, "0.5.1-lab")
                ok_n = n is None or int(n) >= spec["n"]
                ok_m = member is True if spec["member"] else True
                # origin may stay session; n/member must not.
                row = {"url": url, "kind": "health", "status": status, "version": ver, "n": n, "mesh_member": member, "origin": data.get("origin"), "ok_ver": ok_ver, "ok_n": ok_n, "ok_m": ok_m}
                if status >= 400 or not (ok_ver and ok_n and ok_m):
                    row["outdated"] = True
                    row["reason"] = "p0_session_alias" if (n == 1 or member is False) else "mark_mismatch"
                    if not optional:
                        outdated = True
        except Exception as e:
            row = {"url": url, "kind": "health", "error": str(e)[:160]}
            if not optional:
                outdated = True
                row["outdated"] = True
        rows.append(row)
        print(json.dumps(row))

    html_outdated = any(r.get("outdated") and r.get("kind") == "html" for r in rows)
    health_outdated = any(r.get("outdated") and r.get("kind") == "health" for r in rows)
    open("alias-report.json", "w").write(json.dumps({
        "head_mark": HEAD_MARK,
        "outdated_aliases_check": outdated,
        "html_outdated": html_outdated,
        "health_outdated": health_outdated,
        "aliases": rows,
    }, indent=2))
    print("OUTDATED" if outdated else "ALIGNED", HEAD_MARK, "html", html_outdated, "health", health_outdated)
    sys.exit(1 if outdated else 0)


if __name__ == "__main__":
    main()
