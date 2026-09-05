#!/usr/bin/env python3
"""Fog desk collegium bus — propose→constrain→revise→commit|escalate→done.

Updates ops/desk-collegium/state.json (or FOG copy) and appends Fog TUI desk-feed.

Usage (Mac, from FOG_SRC or PATH):
  python3 ops/desk-collegium/desk_bus.py list
  python3 ops/desk-collegium/desk_bus.py propose --owner opencode --specialty code \\
      --intent "needle: desk_bus in protocol tests"
  python3 ops/desk-collegium/desk_bus.py constrain TASK_ID --by hermes --note "ok if no Worker PUT"
  python3 ops/desk-collegium/desk_bus.py revise TASK_ID --intent "narrowed intent"
  python3 ops/desk-collegium/desk_bus.py commit TASK_ID --result "landed" --sha abc1234
  python3 ops/desk-collegium/desk_bus.py done TASK_ID --result "verified"
  python3 ops/desk-collegium/desk_bus.py escalate TASK_ID --note "needs Fog g"
  python3 ops/desk-collegium/desk_bus.py drop TASK_ID --note "superseded"
  python3 ops/desk-collegium/desk_bus.py pulse   # idle specialties → draft proposes (dry print + optional --apply)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
# Prefer live Mac Fog data copy of state when present; else repo ops/
STATE_CANDIDATES = [
    FOG / "data" / "desk-collegium" / "state.json",
    REPO_ROOT / "ops" / "desk-collegium" / "state.json",
]
FEED = FOG / "data" / "desk-feed.jsonl"

VALID_STATUS = ("propose", "constrain", "revise", "commit", "escalate", "done", "drop")
OWNER_ALIASES = {
    "hermes": "hermes@fog.calhegasmorais.pt",
    "opencode": "opencode@fog.calhegasmorais.pt",
    "openclaw": "openclaw@fog.calhegasmorais.pt",
    "stratagrok": "grok@calhegasmorais.pt",
    "grok": "grok@calhegasmorais.pt",
    "fog": "cmn-fog-assistant",
    "edge": "cmn-edge-assistant",
}
SPEC_BY_OWNER = {
    "hermes@fog.calhegasmorais.pt": "coord",
    "opencode@fog.calhegasmorais.pt": "code",
    "openclaw@fog.calhegasmorais.pt": "claw",
    "grok@calhegasmorais.pt": "lead",
}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _clock() -> str:
    return time.strftime("%H:%M:%S")


def resolve_owner(raw: str) -> str:
    s = (raw or "").strip()
    return OWNER_ALIASES.get(s.lower(), s)


def state_path() -> Path:
    """Prefer live Mac FOG/data bus; fall back to repo ops template."""
    fog_p = FOG / "data" / "desk-collegium" / "state.json"
    repo_p = REPO_ROOT / "ops" / "desk-collegium" / "state.json"
    if fog_p.is_file():
        return fog_p
    # When Fog home exists (Mac) or FOG_HOME set, operate on FOG copy
    if os.environ.get("FOG_HOME") or FOG.exists():
        fog_p.parent.mkdir(parents=True, exist_ok=True)
        if not fog_p.is_file() and repo_p.is_file():
            fog_p.write_text(repo_p.read_text(encoding="utf-8"), encoding="utf-8")
        return fog_p
    return repo_p


def load_state() -> dict:
    path = state_path()
    if not path.is_file():
        # seed from repo template if available
        tmpl = REPO_ROOT / "ops" / "desk-collegium" / "state.json"
        if tmpl.is_file():
            data = json.loads(tmpl.read_text(encoding="utf-8"))
        else:
            data = {
                "schema": "desk.collegium.state.v1",
                "version": "0.1.3-lab",
                "members": [],
                "open_tasks": [],
                "last_commit": None,
            }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return data
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(state: dict) -> Path:
    path = state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    state["updated"] = _now()
    # also mirror into repo ops when FOG path is live (best-effort)
    text = json.dumps(state, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")
    repo = REPO_ROOT / "ops" / "desk-collegium" / "state.json"
    try:
        if path.resolve() != repo.resolve():
            repo.write_text(text, encoding="utf-8")
    except Exception:
        pass
    return path


def feed_append(agent: str, text: str, *, kind: str, specialty: str = "") -> None:
    try:
        FEED.parent.mkdir(parents=True, exist_ok=True)
        rec = {
            "ts": _now(),
            "t": _clock(),
            "agent": (agent or "desk")[:32],
            "kind": (kind or "say")[:16],
            "specialty": (specialty or "")[:16],
            "text": (text or "")[:240],
        }
        with FEED.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()
    except Exception as e:
        print(f"feed warn: {e}", file=sys.stderr)


def find_task(state: dict, task_id: str) -> dict | None:
    for t in state.get("open_tasks") or []:
        if t.get("id") == task_id:
            return t
    hist = state.get("done_tasks") or []
    for t in hist:
        if t.get("id") == task_id:
            return t
    return None


def agent_short(owner: str) -> str:
    if "hermes" in owner:
        return "hermes"
    if "opencode" in owner:
        return "opencode"
    if "openclaw" in owner:
        return "openclaw"
    if "grok" in owner:
        return "stratagrok"
    return owner.split("@")[0][:12]


def cmd_list(state: dict) -> int:
    # Mirror open tasks into DESK feed so TUI chat is not empty
    try:
        from desk_metabol import mirror_open_tasks_to_feed, tick as metabol_tick
        metabol_tick()
    except Exception:
        try:
            import importlib.util
            mp = Path(__file__).resolve().parent / "desk_metabol.py"
            spec = importlib.util.spec_from_file_location("desk_metabol", mp)
            mod = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(mod)
            mod.tick()
            state = load_state()
        except Exception:
            pass
    tasks = state.get("open_tasks") or []
    print(f"state={state_path()} updated={state.get('updated')} open={len(tasks)}")
    for t in tasks:
        print(
            f"  {t.get('id')}  [{t.get('status')}]  {t.get('specialty')}  "
            f"owner={agent_short(t.get('owner',''))}  {t.get('intent','')[:80]}"
        )
    lanes = state.get("lanes") or {}
    if lanes:
        bits = [f"{k.replace('lane-','')}={(lanes[k] or {}).get('pace')}" for k in sorted(lanes)]
        print("metabol " + " ".join(bits))
    if not tasks:
        print("  (no open tasks — run propose or pulse --apply)")
    return 0


def cmd_propose(args: argparse.Namespace) -> int:
    state = load_state()
    owner = resolve_owner(args.owner)
    specialty = args.specialty or SPEC_BY_OWNER.get(owner, "coord")
    tid = args.id or f"dt-{uuid.uuid4().hex[:8]}"
    if find_task(state, tid):
        print(f"task exists: {tid}", file=sys.stderr)
        return 2
    task = {
        "schema": "desk.task.v1",
        "id": tid,
        "owner": owner,
        "specialty": specialty,
        "intent": args.intent,
        "lanes": args.lanes or [],
        "status": "propose",
        "constraints": [],
        "result": "",
        "sha": "",
        "created": _now(),
        "updated": _now(),
    }
    state.setdefault("open_tasks", []).append(task)
    save_state(state)
    feed_append(
        agent_short(owner),
        f"propose {tid}: {args.intent}",
        kind="propose",
        specialty=specialty,
    )
    print(tid)
    return 0


def _mutate(task_id: str, status: str, *, by: str, note: str = "", intent: str | None = None,
            result: str = "", sha: str = "", close: bool = False) -> int:
    state = load_state()
    task = find_task(state, task_id)
    if not task:
        print(f"unknown task: {task_id}", file=sys.stderr)
        return 2
    if intent is not None:
        task["intent"] = intent
    if note:
        task.setdefault("constraints", []).append(f"{by}: {note}" if by else note)
    if result:
        task["result"] = result
    if sha:
        task["sha"] = sha
    task["status"] = status
    task["updated"] = _now()
    if close or status in ("done", "drop"):
        open_tasks = [t for t in state.get("open_tasks") or [] if t.get("id") != task_id]
        state["open_tasks"] = open_tasks
        hist = state.setdefault("done_tasks", [])
        hist.append(task)
        state["done_tasks"] = hist[-50:]
        if status == "done":
            state["last_commit"] = {
                "id": task_id,
                "sha": task.get("sha") or "",
                "result": task.get("result") or "",
                "at": _now(),
                "owner": task.get("owner"),
            }
    else:
        # ensure still in open_tasks
        ids = {t.get("id") for t in state.get("open_tasks") or []}
        if task_id not in ids:
            state.setdefault("open_tasks", []).append(task)
    save_state(state)
    specialty = str(task.get("specialty") or "")
    who = agent_short(by or task.get("owner") or "desk")
    body = f"{status} {task_id}"
    if note:
        body += f": {note}"
    elif result:
        body += f": {result}"
    if sha:
        body += f" sha={sha}"
    feed_append(who, body, kind=status if status in VALID_STATUS else "say", specialty=specialty)
    print(task_id, status)
    return 0


def cmd_pulse(args: argparse.Namespace) -> int:
    """If specialty has no open task and lane ALLOW, draft proposes for code+claw."""
    state = load_state()
    open_specs = {t.get("specialty") for t in state.get("open_tasks") or []}
    drafts = []
    if "code" not in open_specs:
        drafts.append(
            ("opencode", "code", "Review Fog desk_bus + DESK feed needles; patch if CI gaps")
        )
    if "claw" not in open_specs:
        drafts.append(
            ("openclaw", "claw", "Probe local :8787/health + :18789 OpenClaw ws; report to feed")
        )
    if "coord" not in open_specs:
        drafts.append(
            ("hermes", "coord", "Collegium pulse: constrain open tasks; ACK Discord only on change")
        )
    if not drafts:
        print("pulse: all specialty lanes already have open tasks")
        cmd_list(state)
        return 0
    for owner, spec, intent in drafts:
        print(f"DRAFT propose --owner {owner} --specialty {spec} --intent {intent!r}")
        if args.apply:
            ns = argparse.Namespace(owner=owner, specialty=spec, intent=intent, id=None, lanes=[])
            cmd_propose(ns)
    if not args.apply:
        print("(dry-run; pass --apply to write)")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Fog desk collegium bus")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="list open tasks")

    pp = sub.add_parser("propose", help="open desk.task.v1")
    pp.add_argument("--owner", required=True)
    pp.add_argument("--specialty", default="")
    pp.add_argument("--intent", required=True)
    pp.add_argument("--id", default="")
    pp.add_argument("--lanes", nargs="*", default=[])

    for name in ("constrain", "revise", "commit", "escalate", "done", "drop"):
        sp = sub.add_parser(name)
        sp.add_argument("task_id")
        sp.add_argument("--by", default="hermes")
        sp.add_argument("--note", default="")
        if name == "revise":
            sp.add_argument("--intent", default="")
        if name == "commit":
            sp.add_argument("--result", default="")
            sp.add_argument("--sha", default="")
        if name == "done":
            sp.add_argument("--result", default="")

    pu = sub.add_parser("pulse", help="draft missing specialty proposes")
    pu.add_argument("--apply", action="store_true")

    args = p.parse_args()
    if args.cmd == "list":
        return cmd_list(load_state())
    if args.cmd == "propose":
        return cmd_propose(args)
    if args.cmd == "pulse":
        return cmd_pulse(args)
    if args.cmd == "constrain":
        return _mutate(args.task_id, "constrain", by=args.by, note=args.note)
    if args.cmd == "revise":
        return _mutate(args.task_id, "revise", by=args.by, note=args.note,
                       intent=args.intent or None)
    if args.cmd == "commit":
        return _mutate(args.task_id, "commit", by=args.by, note=args.note,
                       result=args.result, sha=args.sha)
    if args.cmd == "escalate":
        return _mutate(args.task_id, "escalate", by=args.by, note=args.note)
    if args.cmd == "done":
        return _mutate(args.task_id, "done", by=args.by, note=args.note,
                       result=args.result, close=True)
    if args.cmd == "drop":
        return _mutate(args.task_id, "drop", by=args.by, note=args.note, close=True)
    return 1


if __name__ == "__main__":
    sys.exit(main())
