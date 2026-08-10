#!/usr/bin/env python3
"""
Publish Fog node status to stratamesh-status Worker (POST /ingest).

Usage:
  python3 publish_status.py --url http://127.0.0.1:8787/status
  python3 publish_status.py --file /tmp/live-status.json

Env:
  STATUS_INGEST_URL  (default https://stratamesh-status.stratamesh.workers.dev/ingest)
  STATUS_TOKEN       (required for auth)
"""

from __future__ import annotations
import argparse
import json
import os
import urllib.request


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", help="Local node /status URL")
    p.add_argument("--file", help="JSON status file")
    p.add_argument(
        "--ingest",
        default=os.environ.get(
            "STATUS_INGEST_URL",
            "https://stratamesh-status.stratamesh.workers.dev/ingest",
        ),
    )
    p.add_argument(
        "--token",
        default=os.environ.get("STATUS_TOKEN", "strata-status-ingest-fe2b24ed992ccd30"),
    )
    args = p.parse_args()

    if args.file:
        payload = open(args.file, encoding="utf-8").read()
    elif args.url:
        payload = urllib.request.urlopen(args.url, timeout=10).read().decode()
    else:
        raise SystemExit("Provide --url or --file")

    data = json.loads(payload)
    # strip bulky meter internals if present
    if isinstance(data.get("subsistence"), dict):
        data["subsistence"].pop("meter", None)

    req = urllib.request.Request(
        args.ingest,
        data=json.dumps(data).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Status-Token": args.token,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        print(r.read().decode())


if __name__ == "__main__":
    main()
