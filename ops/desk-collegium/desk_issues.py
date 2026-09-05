#!/usr/bin/env python3
"""Feed GitHub Issues + Challenges tab into the desk collegium bus.

- sync: open issues with labels lab|bug|challenge|desk|aiops → propose (idempotent by source id)
- challenges: local challenges.json items → propose
- Never posts secrets. Uses gh CLI when available.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = "StrataMesh-Laboratory/stratamesh-core"
CHALLENGES = HERE / "challenges.json"
LABELS = ("challenge", "lab-desk", "desk", "bug")  # not blanket aiops (vapour)
MAX_NEW_PER_SYNC = 3


def _bus():
    spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _gh_issues(limit: int = 30) -> list[dict]:
    try:
        r = subprocess.run(
            [
                "gh", "api",
                f"repos/{REPO}/issues?state=open&per_page={limit}",
                "--jq",
                ".[] | {number,title,labels:[.labels[].name],html_url}",
            ],
            capture_output=True,
            text=True,
            timeout=40,
        )
        if r.returncode != 0:
            print(f"gh issues warn: {r.stderr.strip()[:200]}", file=sys.stderr)
            return []
        # gh --jq with multiple objects prints NDJSON when using .[]
        out = []
        for line in r.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        if not out and r.stdout.strip().startswith("["):
            out = json.loads(r.stdout)
        return out
    except Exception as e:
        print(f"gh issues error: {e}", file=sys.stderr)
        return []


def _already_sourced(state: dict, source: str) -> bool:
    for t in (state.get("open_tasks") or []) + (state.get("done_tasks") or []):
        if t.get("source") == source:
            return True
        # also match intent prefix
        intent = t.get("intent") or ""
        if source.startswith("issue:#") and source in intent:
            return True
    return False


def _specialty_from_labels(labels: list[str]) -> str:
    labs = {x.lower() for x in labels}
    if "track:edge" in labs or "edge" in labs:
        return "edge"
    if "challenge" in labs:
        return "coord"
    if "bug" in labs:
        return "code"
    if "aiops" in labs:
        return "fog"
    return "coord"


def _owner_for_spec(spec: str) -> str:
    return {
        "code": "opencode",
        "claw": "openclaw",
        "coord": "hermes",
        "lead": "stratagrok",
        "fog": "fog",
        "edge": "edge",
        "mail": "stratagrok",
    }.get(spec, "hermes")


def cmd_sync(args: argparse.Namespace) -> int:
    bus = _bus()
    state = bus.load_state()
    issues = _gh_issues(args.limit)
    added = 0
    for iss in issues:
        labels = [str(x).lower() for x in (iss.get("labels") or [])]
        # Strict: must carry an explicit desk label (no blanket aiops/domain vapour)
        if not any(l in LABELS for l in labels):
            continue
        source = f"issue:#{iss.get('number')}"
        if _already_sourced(state, source):
            continue
        title = str(iss.get("title") or "")
        # title dedupe against open intents
        norm = " ".join(title.lower().split())[:80]
        if any(norm and norm in (x.get("intent") or "").lower() for x in (state.get("open_tasks") or [])):
            continue
        if added >= MAX_NEW_PER_SYNC:
            print(f"sync cap MAX_NEW_PER_SYNC={MAX_NEW_PER_SYNC} — stop issues")
            break
        spec = _specialty_from_labels(labels)
        intent = f"{source} {title}"
        if args.dry_run:
            print(f"DRAFT {source} specialty={spec} {intent[:90]}")
            continue
        import argparse as ap
        ns = ap.Namespace(
            owner=_owner_for_spec(spec),
            specialty=spec,
            intent=intent[:200],
            id=f"dt-iss{iss.get('number')}",
            lanes=[],
        )
        # propose via bus
        rc = bus.cmd_propose(ns)
        if rc == 0:
            state = bus.load_state()
            task = bus.find_task(state, ns.id)
            if task:
                task["source"] = source
                task["url"] = iss.get("html_url") or ""
                task["labels"] = labels
                task["updated"] = _now()
                bus.save_state(state)
            added += 1
            print(f"proposed {ns.id} from {source}")
        elif "exists" in (""):
            pass
    # challenges file
    if CHALLENGES.is_file():
        data = json.loads(CHALLENGES.read_text(encoding="utf-8"))
        for ch in data.get("items") or []:
            if ch.get("status") != "open":
                continue
            source = f"challenge:{ch.get('id')}"
            if _already_sourced(state, source):
                continue
            spec = ch.get("specialty") or "coord"
            intent = f"{source} {ch.get('title')}: {ch.get('intent') or ''}"
            if args.dry_run:
                print(f"DRAFT {source} specialty={spec} {intent[:90]}")
                continue
            import argparse as ap
            tid = f"dt-{str(ch.get('id') or 'ch')[:12].replace('_','')}"
            ns = ap.Namespace(
                owner=_owner_for_spec(spec),
                specialty=spec,
                intent=intent[:200],
                id=tid,
                lanes=[],
            )
            rc = bus.cmd_propose(ns)
            if rc == 0:
                state = bus.load_state()
                task = bus.find_task(state, tid)
                if task:
                    task["source"] = source
                    task["challenge"] = True
                    task["updated"] = _now()
                    bus.save_state(state)
                added += 1
                print(f"proposed {tid} from {source}")
    if args.dry_run:
        print("(dry-run)")
    else:
        print(f"sync added={added}")
        # refresh feed mirror
        try:
            bus.cmd_list(state if False else bus.load_state())
        except Exception:
            pass
    return 0


def cmd_list(_: argparse.Namespace) -> int:
    bus = _bus()
    state = bus.load_state()
    n = 0
    for t in state.get("open_tasks") or []:
        src = t.get("source") or ""
        if src.startswith("issue:") or src.startswith("challenge:") or t.get("challenge"):
            print(f"{t.get('id')} [{t.get('status')}] {src} {(t.get('intent') or '')[:70]}")
            n += 1
    if CHALLENGES.is_file():
        data = json.loads(CHALLENGES.read_text(encoding="utf-8"))
        print(f"challenges.json open={sum(1 for c in data.get('items') or [] if c.get('status')=='open')}")
    print(f"desk issue/challenge tasks={n}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Issues/Challenges → desk bus")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sync", help="ingest GH issues + challenges.json")
    s.add_argument("--dry-run", action="store_true")
    s.add_argument("--limit", type=int, default=30)
    sub.add_parser("list", help="list desk tasks from issues/challenges")
    args = p.parse_args()
    if args.cmd == "sync":
        return cmd_sync(args)
    if args.cmd == "list":
        return cmd_list(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
