#!/usr/bin/env python3
"""PUT stratamesh-origin-archive from git. Token from env only. No wrangler. No workers.dev."""
from __future__ import annotations

import json
import os
import pathlib
import sys
import uuid
import urllib.request

ACCT = os.environ.get("CF_ACCOUNT") or "f3645fcb56675cf7250d8ba7358eb252"
EMAIL = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"
TOKEN = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
SCRIPT = "stratamesh-origin-archive"
SRC = pathlib.Path(__file__).resolve().parents[2] / "workers" / "stratamesh-origin-archive.js"

BINDINGS = [
    {"type": "r2_bucket", "name": "ARCHIVE", "bucket_name": "cmn-origin-archive"},
    {"type": "d1", "name": "AUTH_DB", "id": "6f898e16-06cb-43e2-80eb-3da14872039e"},
    {"type": "service", "name": "DEOMAIL", "service": "stratamesh-deomail", "environment": "production"},
]


def main() -> int:
    if not TOKEN:
        sys.exit("cf-put-origin: no GOD_API")
    src = SRC.read_bytes()
    boundary = "----OriginGit" + uuid.uuid4().hex
    meta = json.dumps({
        "main_module": "stratamesh-origin-archive.js",
        "compatibility_date": "2024-12-01",
        "bindings": BINDINGS,
    }).encode()

    def part(name, filename, content, ctype):
        disp = 'Content-Disposition: form-data; name="%s"' % name
        if filename:
            disp += '; filename="%s"' % filename
        return (
            ("--%s\r\n" % boundary).encode()
            + (disp + "\r\n").encode()
            + ("Content-Type: %s\r\n\r\n" % ctype).encode()
            + content
            + b"\r\n"
        )

    body = (
        part("metadata", "metadata.json", meta, "application/json")
        + part("stratamesh-origin-archive.js", "stratamesh-origin-archive.js", src, "application/javascript+module")
        + ("--%s--\r\n" % boundary).encode()
    )
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/accounts/%s/workers/scripts/%s" % (ACCT, SCRIPT),
        data=body,
        method="PUT",
        headers={
            "Authorization": "Bearer " + TOKEN,
            "X-Auth-Email": EMAIL,
            "Content-Type": "multipart/form-data; boundary=" + boundary,
            "User-Agent": "stratamesh-origin-align/1",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read().decode())
    if not d.get("success"):
        sys.exit("cf-put-origin failed %s" % d.get("errors"))
    print("origin-archive PUT ok bytes=%s" % len(src))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
