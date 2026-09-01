#!/usr/bin/env python3
"""Public-wide outdated_aliases_check vs origin/main HEAD."""
import json, os, re, sys, urllib.request

HEAD_MARK = os.environ.get("HEAD_MARK", "v0.5.0-lab")
ALIASES = [
    "https://calhegasmorais.pt/",
    "https://www.calhegasmorais.pt/",
    "https://calhegasmorais-pt.pages.dev/",
    "https://calhegasmorais.pt/dashboard",
    "https://calhegasmorais-pt.pages.dev/dashboard",
    "https://sandbox.calhegasmorais.pt/",
    "https://stratamesh.pages.dev/",
]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "cmn-alias-check", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as r:
        body = r.read().decode("utf-8", "replace")
        return r.status, body, r.geturl()

def main():
    rows = []
    outdated = False
    for url in ALIASES:
        try:
            status, body, final = fetch(url)
            has = HEAD_MARK in body
            vers = sorted(set(re.findall(r"v0\\.\\d+\\.\\d[\\w.-]*", body)))
            row = {"url": url, "status": status, "final": final, "has_head_mark": has, "versions": vers, "bytes": len(body)}
            if status >= 400 or not has:
                outdated = True
                row["outdated"] = True
        except Exception as e:
            outdated = True
            row = {"url": url, "error": str(e), "outdated": True}
        rows.append(row)
        print(json.dumps(row))
    report = {"head_mark": HEAD_MARK, "outdated_aliases_check": outdated, "aliases": rows}
    open("alias-report.json", "w").write(json.dumps(report, indent=2))
    print("OUTDATED" if outdated else "ALIGNED", HEAD_MARK)
    sys.exit(1 if outdated else 0)

if __name__ == "__main__":
    main()
