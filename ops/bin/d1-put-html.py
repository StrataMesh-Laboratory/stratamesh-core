#!/usr/bin/env python3
"""Push frontend HTML from git into D1 site_content_chunks.

Live apex reads LEDGER keys, not the repo file. This is the ship path.
No wrangler. No workers.dev. Secrets from env only.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request

CF_ACCOUNT = os.environ.get("CF_ACCOUNT") or "f3645fcb56675cf7250d8ba7358eb252"
EMAIL = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"
D1_ID = os.environ.get("D1_LEDGER_ID") or "f78ff995-03d2-4b97-88b6-56e61416fce7"
TOKEN = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
CHUNK = 7000

# mechanics of route 2 — one file fans out to the keys spa actually reads
PATH_MAP = {
    "frontend/landing-pt.html": ("home-pt", "home", "landing-pt"),
    "frontend/landing-en.html": ("home-en", "landing-en"),
    "frontend/portal-pt.html": ("portal-pt", "portal"),
    "frontend/portal-en.html": ("portal-en",),
    "frontend/roadmap-pt.html": ("roadmap-pt", "roadmap"),
    "frontend/roadmap-en.html": ("roadmap-en",),
    "frontend/eni.html": ("eni", "eni-pt"),
    "frontend/sandbox.html": ("sandbox",),
    "frontend/gnu-atelier.html": ("atelier",),
    "frontend/fog-appliance.html": ("fog-appliance", "fog-appliance-en"),
    "frontend/fog-infrastructure.html": ("fog-infrastructure", "fog-infrastructure-en"),
}

WORKER_MAP = {
    "workers/stratamesh-fog-standby.js": ("stratamesh-fog-standby", True),
    "workers/stratamesh-status.js": ("stratamesh-status", False),
}


def token() -> str:
    if not TOKEN:
        sys.exit("d1-put-html: no GOD_API / CLOUDFLARE_API_TOKEN")
    return TOKEN


def cf(method: str, path: str, data=None, content_type="application/json"):
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4" + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + token(),
            "X-Auth-Email": EMAIL,
            "User-Agent": "stratamesh-live-from-git",
        },
    )
    if data is not None:
        req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:400]
        body = re.sub(r"(ghp_|ghu_|github_pat_|cfat_|cfut_|Bearer\s+)[A-Za-z0-9_\-.]{8,}", r"\1[redacted]", body)
        raise SystemExit(f"CF {method} {path} {e.code}") from e


def d1(sql: str, params=None):
    payload = {"sql": sql}
    if params is not None:
        payload["params"] = params
    d = cf(
        "POST",
        f"/accounts/{CF_ACCOUNT}/d1/database/{D1_ID}/query",
        json.dumps(payload).encode(),
    )
    if not d.get("success"):
        raise SystemExit(f"D1 fail {d.get('errors')}")
    return d


def put_html(key: str, html: str) -> int:
    parts = [html[i : i + CHUNK] for i in range(0, len(html), CHUNK)] or [""]
    d1("DELETE FROM site_content_chunks WHERE key = ?", [key])
    import time as _t
    _t.sleep(0.15)
    for i, part in enumerate(parts):
        d1(
            "INSERT OR REPLACE INTO site_content_chunks (key, idx, value) VALUES (?, ?, ?)",
            [key, i, part],
        )
    return len(parts)


def put_module_worker(script: str, source: bytes) -> None:
    import uuid

    boundary = "----LiveGit" + uuid.uuid4().hex
    meta = json.dumps(
        {
            "main_module": "index.js",
            "compatibility_date": "2024-12-01",
        }
    ).encode()

    def part(name, filename, content, ctype):
        disp = f'Content-Disposition: form-data; name="{name}"'
        if filename:
            disp += f'; filename="{filename}"'
        return (
            f"--{boundary}\r\n".encode()
            + (disp + "\r\n").encode()
            + f"Content-Type: {ctype}\r\n\r\n".encode()
            + content
            + b"\r\n"
        )

    body = (
        part("metadata", "metadata.json", meta, "application/json")
        + part("index.js", "index.js", source, "application/javascript+module")
        + f"--{boundary}--\r\n".encode()
    )
    cf(
        "PUT",
        f"/accounts/{CF_ACCOUNT}/workers/scripts/{script}",
        body,
        f"multipart/form-data; boundary={boundary}",
    )


def main() -> int:
    files = [a for a in sys.argv[1:] if a and not a.startswith("-")]
    force = "--all" in sys.argv
    if force or not files:
        files = [p for p in PATH_MAP if os.path.isfile(p)]
        extra = [p for p in WORKER_MAP if os.path.isfile(p)]
    else:
        extra = [p for p in files if p in WORKER_MAP]
        files = [p for p in files if p in PATH_MAP]

    if not files and not extra:
        print("d1-put-html: nothing mapped")
        return 0

    for path in files:
        if not os.path.isfile(path):
            print("skip missing", path)
            continue
        html = open(path, encoding="utf-8").read()
        for key in PATH_MAP[path]:
            n = put_html(key, html)
            print(f"D1 {path} → {key} chunks={n} bytes={len(html)}")

    for path in extra:
        script, module = WORKER_MAP[path]
        raw = open(path, "rb").read()
        if module:
            put_module_worker(script, raw)
            print(f"CF PUT {path} → {script} module bytes={len(raw)}")
        else:
            print(f"HOLD worker {path} → {script} (service-worker PUT not in this job)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
