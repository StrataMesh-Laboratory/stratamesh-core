#!/usr/bin/env python3
"""Compare git Worker sources to live CF /content. Observe only. No PUT.

Needs GOD_API. Fail closed (exit 2) if token missing when --require-token.
Exit 1 on hard drift. Exit 0 if live matches git, or only hold_put scripts differ.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from email.parser import BytesParser
from email.policy import default
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CF_ACCOUNT = os.environ.get("CF_ACCOUNT") or "f3645fcb56675cf7250d8ba7358eb252"
EMAIL = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"


def _load_cfg() -> dict:
    p = ROOT / "ops/config/worker-allow.json"
    return json.loads(p.read_text()) if p.is_file() else {}


_CFG = _load_cfg()
MAP = {rel: name for name, rel in (_CFG.get("scripts") or {}).items()}
HOLD_PUT = set(_CFG.get("hold_put") or [])


def token() -> str:
    t = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not t and Path("/tmp/god_api").is_file():
        t = Path("/tmp/god_api").read_text().strip()
    return t


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def live_content(tok: str, script: str) -> bytes | None:
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/workers/scripts/{script}"
    req = urllib.request.Request(
        url,
        headers={"X-Auth-Email": EMAIL, "Authorization": "Bearer " + tok},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            ct = r.headers.get("Content-Type") or ""
    except urllib.error.HTTPError as e:
        print(f"GET {script} HTTP {e.code}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"GET {script} {type(e).__name__}", file=sys.stderr)
        return None
    if "multipart/" in ct.lower():
        msg = BytesParser(policy=default).parsebytes(
            b"MIME-Version: 1.0\r\nContent-Type: " + ct.encode() + b"\r\n\r\n" + raw
        )
        for part in msg.iter_parts():
            payload = part.get_payload(decode=True)
            if not payload:
                continue
            fn = (part.get_filename() or "").lower()
            ptype = (part.get_content_type() or "").lower()
            if fn.endswith(".js") or "javascript" in ptype:
                return payload
        for part in msg.iter_parts():
            payload = part.get_payload(decode=True) or b""
            if payload.startswith(b"{") or b'"success"' in payload[:40]:
                continue
            if len(payload) > 100:
                return payload
    return raw


def main() -> int:
    require = "--require-token" in sys.argv
    tok = token()
    if not tok:
        print("gitlive-drift: no GOD_API", file=sys.stderr)
        return 2 if require else 0

    rows = []
    hard = []
    soft = []
    for rel, script in MAP.items():
        p = ROOT / rel
        if not p.is_file():
            rows.append({"script": script, "git": rel, "status": "missing_git"})
            continue
        git_b = p.read_bytes()
        live_b = live_content(tok, script)
        if live_b is None:
            rows.append({"script": script, "git": rel, "status": "live_fetch_fail", "git_sha": sha256_bytes(git_b)[:12]})
            hard.append(script)
            continue
        gs, ls = sha256_bytes(git_b), sha256_bytes(live_b)
        match = gs == ls
        hold = script in HOLD_PUT
        status = "match" if match else ("DRIFT-HOLD" if hold else "DRIFT")
        rows.append({
            "script": script,
            "git": rel,
            "status": status,
            "git_sha": gs[:12],
            "live_sha": ls[:12],
            "git_bytes": len(git_b),
            "live_bytes": len(live_b),
        })
        if not match:
            (soft if hold else hard).append(script)

    print("| script | status | git | live |")
    print("|---|---|---|---|")
    for r in rows:
        print(f"| {r['script']} | {r['status']} | {r.get('git_sha','')} | {r.get('live_sha','')} |")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write("## gitlive-drift\n\n")
            fh.write("| script | status | git | live |\n|---|---|---|---|\n")
            for r in rows:
                fh.write(f"| {r['script']} | {r['status']} | {r.get('git_sha','')} | {r.get('live_sha','')} |\n")
    Path("/tmp/gitlive-drift.json").write_text(json.dumps(rows, indent=2))
    if soft:
        print("HOLD_PUT " + ",".join(soft), file=sys.stderr)
    if hard:
        print("DRIFT " + ",".join(hard), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
