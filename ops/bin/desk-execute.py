#!/usr/bin/env python3
"""Grok-side execute: git (Git Data) + live (CF PUT) + Discourse t/20.

Never scheduled in GitHub Actions. Q-gate first (fail closed). Allow-list only.
Local secrets from env or /tmp — never print them.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOPIC = 20
FORUM = "https://stratamesh.discourse.group"

ALLOW = {}


def load_allow() -> dict[str, str]:
    p = ROOT / "ops/config/worker-allow.json"
    data = json.loads(p.read_text()) if p.is_file() else {}
    return dict(data.get("scripts") or {})


def load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def god_token() -> str:
    t = (os.environ.get("GOD_API") or os.environ.get("CLOUDFLARE_API_TOKEN") or "").strip()
    if not t and Path("/tmp/god_api").is_file():
        t = Path("/tmp/god_api").read_text().strip()
    return t


def q_gate(tick, email: str, tok: str) -> tuple[bool, dict]:
    if not tok:
        return False, {"error": "no GOD_API"}
    metab = tick.cf_graphql(email, tok) or {"error": "graphql none"}
    ok = (
        not metab.get("error")
        and not metab.get("circuit_hold")
        and not metab.get("circuit_stasis")
        and int(metab.get("remaining") or 0) >= 500
    )
    return ok, metab


def discourse_reply(body: str) -> dict:
    key = (os.environ.get("DISCOURSE_API_KEY") or "").strip()
    if not key and Path("/tmp/discourse_api").is_file():
        key = Path("/tmp/discourse_api").read_text().strip()
    user = os.environ.get("DISCOURSE_API_USER") or "stratamesh-grok"
    if not key:
        return {"ok": False, "hold": "no DISCOURSE_API_KEY — draft only", "draft": body}
    payload = json.dumps({"topic_id": TOPIC, "raw": body}).encode()
    req = urllib.request.Request(
        FORUM + "/posts.json",
        data=payload,
        method="POST",
        headers={
            "Api-Key": key,
            "Api-Username": user,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode() or "{}")
        return {"ok": True, "post_id": data.get("id"), "topic_id": data.get("topic_id")}
    except urllib.error.HTTPError as e:
        return {"ok": False, "http": e.code, "hold": e.read()[:300].decode("utf-8", "replace")}


def main() -> int:
    if os.environ.get("GITHUB_ACTIONS"):
        print("HOLD: desk-execute is Grok-only. Actions runs desk-prepare.", file=sys.stderr)
        return 2
    ap = argparse.ArgumentParser()
    ap.add_argument("--git", action="store_true")
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--discourse", action="store_true")
    ap.add_argument("--scripts", default="")
    ap.add_argument("--message", default="")
    ap.add_argument("--body-file", default="")
    ap.add_argument("--from-pack", default="", help="PUBLISH-PACK.json from desk-prepare artifact")
    args = ap.parse_args()
    pack = {}
    if args.from_pack:
        pack = json.loads(Path(args.from_pack).read_text())
        if pack.get("scripts") and not args.scripts:
            args.scripts = ",".join(pack["scripts"])
        if not args.body_file:
            draft = (pack.get("discourse") or {}).get("draft")
            if draft:
                tmp = Path("/tmp/desk-tick")
                tmp.mkdir(parents=True, exist_ok=True)
                (tmp / "DISCOURSE-DRAFT.md").write_text(draft)
                args.body_file = str(tmp / "DISCOURSE-DRAFT.md")
    if not (args.git or args.live or args.discourse):
        args.git = args.live = args.discourse = True

    tick = load("desk_tick", "ops/bin/desk-tick.py")
    agl = load("agl", "scripts/api-gitlive-publish.py")
    email = os.environ.get("CLOUDFLARE_EMAIL") or "amcmorais@icloud.com"
    tok = god_token()
    allow, metab = q_gate(tick, email, tok)
    print("q-gate", "ALLOW" if allow else "HOLD", metab)
    if (args.git or args.live) and not allow:
        print("HOLD execute git/live — circuit or no remaining sample", file=sys.stderr)
        return 0

    allow_map = load_allow()
    wanted = [s.strip() for s in args.scripts.split(",") if s.strip()]
    if not wanted:
        wanted = list(allow_map)
    unknown = [s for s in wanted if s not in allow_map]
    if unknown:
        print("HOLD unknown scripts " + ",".join(unknown), file=sys.stderr)
        return 1
    files = [allow_map[s] for s in wanted if (ROOT / allow_map[s]).is_file()]

    sha = None
    if args.git and files:
        pat = agl.load_pat()
        msg = args.message or (
            "ops(desk-execute): git+live from Grok after Actions prepare\n\n"
            "Q-gated. Never workers.dev. Never a 6th cron."
        )
        sha = agl.commit_files(ROOT, files, msg, pat)
        print("git", sha)

    if args.live and files:
        failed = []
        for script in wanted:
            src = ROOT / allow_map[script]
            if not src.is_file():
                continue
            main_mod = agl.MAIN_MODULE.get(script) or "index.js"
            out = agl.cf_put_content(email, tok, src, script=script, main_module=main_mod)
            print("live", script, out.get("http"), out.get("success"))
            if not out.get("success"):
                failed.append(script)
        if failed:
            print("PUT FAIL " + ",".join(failed), file=sys.stderr)
            return 1

    if args.discourse:
        if args.body_file and Path(args.body_file).is_file():
            body = Path(args.body_file).read_text()
        else:
            pack = Path("/tmp/desk-tick/DISCOURSE-DRAFT.md")
            body = pack.read_text() if pack.is_file() else (
                f"EDGE-GROK execute {sha or 'no-git'} · lab n=1 · custom domains only.\n"
            )
        d = discourse_reply(body)
        print("discourse", d)
        if not d.get("ok"):
            print("DISCOURSE HOLD — posted nowhere; draft left for Grok session", file=sys.stderr)

    print("execute done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
