#!/usr/bin/env python3
"""Plug GitHub Actions into the Fog desk collegium.

Syncs recent workflow runs into DESK feed + optional bus tasks on CI fail.
Never prints secrets. Never workers.dev.

Usage:
  python3 ops/desk-collegium/desk_actions.py sync [--limit 15]
  python3 ops/desk-collegium/desk_actions.py status
  python3 ops/desk-collegium/desk_actions.py dispatch desk-tick|desk-prepare|desk-collegium
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

def _gh_bin() -> str | None:
    import shutil
    import os
    for cand in (
        shutil.which("gh"),
        "/opt/homebrew/bin/gh",
        "/usr/local/bin/gh",
        str(Path.home() / "bin/gh"),
    ):
        if cand and Path(cand).is_file() and os.access(cand, os.X_OK):
            return cand
    return None



# Workflows that are desk-relevant
DESK_WORKFLOWS = (
    "desk-tick",
    "desk-prepare",
    "desk-publish",
    "desk-collegium",
    "protocol-invariants",
    "secrets-guard",
    "dev-labor",
    "gha-fail-watch",
    "cursor-desk",
)


def _bus():
    spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _gh_json(args: list[str]) -> list | dict | None:
    gh = _gh_bin()
    if not gh:
        return None
    try:
        r = subprocess.run(
            [gh, *args],
            capture_output=True,
            text=True,
            timeout=45,
            env={**__import__("os").environ, "PATH": "/opt/homebrew/bin:/usr/local/bin:" + __import__("os").environ.get("PATH", "")},
        )
        if r.returncode != 0:
            print(f"gh warn: {r.stderr.strip()[:200]}", file=sys.stderr)
            return None
        return json.loads(r.stdout) if r.stdout.strip() else None
    except Exception as e:
        print(f"gh error: {e}", file=sys.stderr)
        return None


def list_runs(limit: int = 15) -> list[dict]:
    data = _gh_json([
        "run", "list",
        "-R", REPO,
        "--limit", str(limit),
        "--json", "databaseId,displayTitle,workflowName,status,conclusion,headBranch,url,createdAt,updatedAt,event",
    ])
    return data if isinstance(data, list) else []


def cmd_status(_: argparse.Namespace) -> int:
    runs = list_runs(10)
    if not runs:
        print("actions=unavailable_or_empty")
        return 2
    deskish = [r for r in runs if any(w in str(r.get("workflowName") or "").lower() for w in DESK_WORKFLOWS)]
    print(f"runs={len(runs)} desk_related={len(deskish)}")
    for r in runs[:8]:
        print(
            f"  {(r.get('conclusion') or r.get('status') or '?'):10} "
            f"{(r.get('workflowName') or '')[:28]:28} "
            f"#{r.get('databaseId')} {(r.get('displayTitle') or '')[:50]}"
        )
    return 0


def cmd_sync(args: argparse.Namespace) -> int:
    bus = _bus()
    runs = list_runs(args.limit)
    if not runs:
        # Rate-limit feed noise (TUI r/60s); do not escalate every cycle
        fog = Path((__import__("os").environ.get("FOG_HOME") or str(Path.home() / "StrataMesh/fog")))
        flag = fog / "data" / "desk-actions-gh-miss.ts"
        now = time.time()
        last = 0.0
        try:
            last = float(flag.read_text().strip() or "0")
        except Exception:
            last = 0.0
        if now - last >= 600:
            bus.feed_append(
                "desk",
                "actions sync: gh unavailable — install/auth gh or PATH=/opt/homebrew/bin",
                kind="say",
                specialty="code",
            )
            try:
                flag.parent.mkdir(parents=True, exist_ok=True)
                flag.write_text(str(now))
            except Exception:
                pass
        print(json.dumps({"ok": False, "reason": "gh_unavailable", "mirrored": 0}))
        return 0  # soft — desk cycle continues
    mirrored = 0
    failed = 0
    state = bus.load_state()
    known = {
        t.get("source")
        for t in (state.get("open_tasks") or []) + (state.get("done_tasks") or [])
    }
    for r in runs:
        wf = str(r.get("workflowName") or "")
        conc = str(r.get("conclusion") or "")
        status = str(r.get("status") or "")
        rid = r.get("databaseId")
        source = f"actions:run:{rid}"
        # feed line for desk-related or failures
        interesting = any(w in wf.lower() for w in DESK_WORKFLOWS) or conc == "failure"
        if not interesting:
            continue
        line = f"GHA {wf}: {conc or status} #{rid}"
        if not args.dry_run:
            bus.feed_append("opencode", line[:200], kind="say", specialty="code")
        mirrored += 1
        if conc == "failure" and source not in known and not args.dry_run:
            failed += 1
            ns = argparse.Namespace(
                owner="opencode",
                specialty="code",
                intent=f"{source} FAIL {wf}: {(r.get('displayTitle') or '')[:120]}",
                id=f"dt-gha{rid}",
                lanes=["lane-opencode"],
            )
            if bus.cmd_propose(ns) == 0:
                state = bus.load_state()
                task = bus.find_task(state, ns.id)
                if task:
                    task["source"] = source
                    task["url"] = r.get("url") or ""
                    task["updated"] = _now()
                    bus.save_state(state)
                print(f"proposed {ns.id} from {source}")
    # write meter for connectors
    try:
        fog = Path((__import__("os").environ.get("FOG_HOME") or str(Path.home() / "StrataMesh/fog")))
        meters = fog / "data" / "desk-meters"
        meters.mkdir(parents=True, exist_ok=True)
        (meters / "github-actions.json").write_text(json.dumps({
            "ts": _now(),
            "runs_seen": len(runs),
            "mirrored": mirrored,
            "failures_opened": failed,
        }, indent=2) + "\n")
    except Exception:
        pass
    print(json.dumps({"ok": True, "mirrored": mirrored, "failures_opened": failed, "runs": len(runs)}))
    return 0


def cmd_dispatch(args: argparse.Namespace) -> int:
    wf = args.workflow
    # map short names
    names = {
        "desk-tick": "desk-tick.yml",
        "desk-prepare": "desk-prepare.yml",
        "desk-publish": "desk-publish.yml",
        "desk-collegium": "desk-collegium.yml",
        "protocol-invariants": "protocol-invariants.yml",
    }
    file = names.get(wf, wf)
    r = subprocess.run(
        [_gh_bin() or "gh", "workflow", "run", file, "-R", REPO],
        capture_output=True,
        text=True,
        timeout=30,
    )
    print(r.stdout or r.stderr)
    bus = _bus()
    bus.feed_append(
        "opencode",
        f"actions dispatch {file} rc={r.returncode}",
        kind="propose" if r.returncode == 0 else "escalate",
        specialty="code",
    )
    return r.returncode


def main() -> int:
    p = argparse.ArgumentParser(description="GitHub Actions ↔ desk")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="list recent runs")
    s = sub.add_parser("sync", help="mirror runs → feed (+ fail tasks)")
    s.add_argument("--limit", type=int, default=15)
    s.add_argument("--dry-run", action="store_true")
    d = sub.add_parser("dispatch", help="workflow_dispatch a desk workflow")
    d.add_argument("workflow", help="desk-tick|desk-prepare|desk-collegium|…")
    args = p.parse_args()
    if args.cmd == "status":
        return cmd_status(args)
    if args.cmd == "sync":
        return cmd_sync(args)
    if args.cmd == "dispatch":
        return cmd_dispatch(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
