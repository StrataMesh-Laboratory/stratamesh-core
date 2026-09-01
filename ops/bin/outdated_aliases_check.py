#!/usr/bin/env python3
import json, os, sys, urllib.request
HEAD_MARK = os.environ.get("HEAD_MARK", "v0.5.0-lab")
DEBUG = os.environ.get("DEBUG") == "1"
ALIASES = [
    {"url": "https://calhegasmorais.pt/", "marks": [HEAD_MARK]},
    {"url": "https://www.calhegasmorais.pt/", "marks": [HEAD_MARK]},
    {"url": "https://calhegasmorais-pt.pages.dev/", "marks": [HEAD_MARK]},
    {"url": "https://calhegasmorais.pt/dashboard", "marks": [HEAD_MARK]},
    {"url": "https://sandbox.calhegasmorais.pt/", "marks": ["v0.5.0-session", "Atelier GNU"]},
]
def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "cmn-alias-check", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.read().decode("utf-8", "replace"), r.geturl(), dict(r.headers)
def main():
    rows=[]; outdated=False
    for spec in ALIASES:
        url, marks = spec["url"], spec["marks"]
        try:
            status, body, final, hdrs = fetch(url)
            has = any(m in body for m in marks)
            row = {"url": url, "status": status, "final": final, "has_mark": has, "bytes": len(body), "cache": hdrs.get("cf-cache-status") or hdrs.get("CF-Cache-Status")}
            if DEBUG:
                row["title"] = (body[body.find("<title>"):body.find("</title>")+8] if "<title>" in body else "")[:90]
            if status >= 400 or not has:
                outdated=True; row["outdated"]=True
        except Exception as e:
            outdated=True; row={"url": url, "error": str(e)[:160], "outdated": True}
        rows.append(row); print(json.dumps(row))
    open("alias-report.json","w").write(json.dumps({"head_mark": HEAD_MARK, "outdated_aliases_check": outdated, "aliases": rows}, indent=2))
    print("OUTDATED" if outdated else "ALIGNED", HEAD_MARK)
    sys.exit(1 if outdated else 0)
if __name__ == "__main__":
    main()
