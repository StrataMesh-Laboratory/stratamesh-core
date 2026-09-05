#!/usr/bin/env python3
"""Collegium ship-live gate — majority ACK required; unanimous = full authority.

Law:
  - Ship live only when a collegial majority of voting members ACK.
  - If all voters ACK (unanimous), the organ has full authority to ship.
  - Any NACK blocks ship (revise or escalate to André).
  - Human gates (Fog g, 2FA, Oracle, Renovate majors) still escalate.

Votes live on the task: task["votes"] = [{"by": "...", "vote": "ack"|"nack", "at": "...", "note": "..."}]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# Reuse bus state helpers
import importlib.util

HERE = Path(__file__).resolve().parent


def _load_bus():
    spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


bus = _load_bus()

DEFAULT_VOTERS = [
    {"id": "stratagrok", "owner": "grok@calhegasmorais.pt", "vote": True, "role": "lead"},
    {"id": "hermes", "owner": "hermes@fog.calhegasmorais.pt", "vote": True, "role": "coord"},
    {"id": "opencode", "owner": "opencode@fog.calhegasmorais.pt", "vote": True, "role": "code"},
    {"id": "openclaw", "owner": "openclaw@fog.calhegasmorais.pt", "vote": True, "role": "claw"},
    {"id": "fog-assistant", "owner": "cmn-fog-assistant", "vote": True, "role": "fog"},
    {"id": "edge-assistant", "owner": "cmn-edge-assistant", "vote": True, "role": "edge"},
]


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def ensure_ship_policy(state: dict) -> dict:
    policy = state.setdefault(
        "ship_policy",
        {
            "schema": "desk.ship_policy.v1",
            "majority_frac": 0.5,
            "require_no_nack": True,
            "unanimous_authority": True,
            "human_escalate": ["fog_g", "2fa", "oracle", "renovate_major"],
        },
    )
    members = state.get("members") or []
    if not members:
        state["members"] = list(DEFAULT_VOTERS)
    else:
        # ensure vote flag exists
        for m in members:
            if "vote" not in m:
                m["vote"] = True
    return policy


def voters(state: dict) -> list[dict]:
    ensure_ship_policy(state)
    return [m for m in (state.get("members") or []) if m.get("vote")]


def normalize_voter(raw: str) -> str:
    s = (raw or "").strip().lower()
    aliases = {
        "stratagrok": "stratagrok",
        "grok": "stratagrok",
        "hermes": "hermes",
        "opencode": "opencode",
        "openclaw": "openclaw",
        "fog": "fog-assistant",
        "fog-assistant": "fog-assistant",
        "edge": "edge-assistant",
        "edge-assistant": "edge-assistant",
    }
    if s in aliases:
        return aliases[s]
    for m in DEFAULT_VOTERS:
        if s == m["id"] or s in m["owner"]:
            return m["id"]
    return s


def tally(task: dict, state: dict) -> dict:
    policy = ensure_ship_policy(state)
    vs = voters(state)
    n = max(len(vs), 1)
    votes = task.get("votes") or []
    # last vote per voter wins
    by_map: dict[str, str] = {}
    for v in votes:
        vid = normalize_voter(str(v.get("by") or ""))
        by_map[vid] = str(v.get("vote") or "").lower()
    acks = sum(1 for m in vs if by_map.get(m["id"]) == "ack")
    nacks = sum(1 for m in vs if by_map.get(m["id"]) == "nack")
    cast = sum(1 for m in vs if by_map.get(m["id"]) in ("ack", "nack"))
    need = max(1, int(n * float(policy.get("majority_frac") or 0.5) + 0.999))  # ceil
    # classic majority: > 50% of voters → ceil((n+1)/2) for even? use ceil(n * frac)
    # For frac=0.5 and n=6: int(3+0.999)=3 — require at least 3 ACK (half). Prefer strict majority:
    need = (n // 2) + 1  # strict majority
    unanimous = acks == n and nacks == 0
    majority = acks >= need and (nacks == 0 if policy.get("require_no_nack", True) else True)
    authority = "unanimous" if unanimous else ("majority" if majority else "none")
    return {
        "voters": n,
        "acks": acks,
        "nacks": nacks,
        "cast": cast,
        "need": need,
        "majority": majority,
        "unanimous": unanimous,
        "authority": authority,
        "by_map": by_map,
    }


def cmd_vote(args: argparse.Namespace) -> int:
    state = bus.load_state()
    ensure_ship_policy(state)
    task = bus.find_task(state, args.task_id)
    if not task:
        print(f"unknown task: {args.task_id}", file=sys.stderr)
        return 2
    vote = args.vote.lower()
    if vote not in ("ack", "nack"):
        print("vote must be ack|nack", file=sys.stderr)
        return 2
    who = normalize_voter(args.by)
    votes = task.setdefault("votes", [])
    # replace prior vote by same voter
    votes = [v for v in votes if normalize_voter(str(v.get("by") or "")) != who]
    votes.append({"by": who, "vote": vote, "at": _now(), "note": args.note or ""})
    task["votes"] = votes
    task["updated"] = _now()
    if not task.get("ship_live"):
        task["ship_live"] = True
    # keep in open_tasks
    ids = {t.get("id") for t in state.get("open_tasks") or []}
    if args.task_id not in ids:
        # may be in done — reject
        print(f"task not open: {args.task_id}", file=sys.stderr)
        return 2
    bus.save_state(state)
    t = tally(task, state)
    bus.feed_append(
        who,
        f"{vote} {args.task_id} acks={t['acks']}/{t['voters']} need={t['need']} auth={t['authority']}",
        kind="constrain" if vote == "ack" else "escalate",
        specialty=str(task.get("specialty") or "coord"),
    )
    print(json.dumps({"task": args.task_id, "vote": vote, "by": who, **{k: t[k] for k in t if k != "by_map"}}, indent=2))
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    state = bus.load_state()
    ensure_ship_policy(state)
    if args.task_id:
        task = bus.find_task(state, args.task_id)
        if not task:
            print(f"unknown task: {args.task_id}", file=sys.stderr)
            return 2
        t = tally(task, state)
        print(json.dumps({"task": args.task_id, "ship_live": bool(task.get("ship_live")), **{k: t[k] for k in t if k != "by_map"}}, indent=2))
        return 0
    # summary of open ship_live tasks
    for task in state.get("open_tasks") or []:
        if not task.get("ship_live") and args.ship_only:
            continue
        t = tally(task, state)
        print(
            f"{task.get('id')} ship={bool(task.get('ship_live'))} "
            f"acks={t['acks']}/{t['voters']} need={t['need']} auth={t['authority']} "
            f"{(task.get('intent') or '')[:60]}"
        )
    print(f"voters={[m.get('id') for m in voters(state)]}")
    return 0


def cmd_mark(args: argparse.Namespace) -> int:
    """Mark a task as ship_live candidate (needs majority before ship)."""
    state = bus.load_state()
    ensure_ship_policy(state)
    task = bus.find_task(state, args.task_id)
    if not task:
        print(f"unknown task: {args.task_id}", file=sys.stderr)
        return 2
    task["ship_live"] = True
    task["updated"] = _now()
    bus.save_state(state)
    bus.feed_append(
        bus.agent_short(args.by or task.get("owner") or "desk"),
        f"ship-candidate {args.task_id}: {(task.get('intent') or '')[:120]}",
        kind="propose",
        specialty=str(task.get("specialty") or "coord"),
    )
    print(args.task_id, "ship_live=true")
    return 0


def cmd_ship(args: argparse.Namespace) -> int:
    """Execute ship only if majority (or unanimous) — records last_ship; does not force Mac g."""
    state = bus.load_state()
    policy = ensure_ship_policy(state)
    task = bus.find_task(state, args.task_id)
    if not task:
        print(f"unknown task: {args.task_id}", file=sys.stderr)
        return 2
    if not task.get("ship_live"):
        print("task not marked ship_live — run: desk_ship.py mark TASK", file=sys.stderr)
        return 2
    t = tally(task, state)
    if not t["majority"]:
        print(
            f"REFUSED ship: need majority ACK ({t['acks']}/{t['voters']}, need>={t['need']}, nacks={t['nacks']})",
            file=sys.stderr,
        )
        bus.feed_append(
            "desk",
            f"ship-refused {args.task_id} acks={t['acks']}/{t['voters']} nacks={t['nacks']}",
            kind="escalate",
            specialty=str(task.get("specialty") or "coord"),
        )
        return 3
    # Connector ship gates (best-effort)
    try:
        import importlib.util as iu
        sp = HERE / "desk_connectors.py"
        spec = iu.spec_from_file_location("desk_connectors", sp)
        cmod = iu.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(cmod)
        bad = []
        for surf in (cmod.load_registry().get("surfaces") or []):
            if not surf.get("ship_gate"):
                continue
            st = cmod.probe_surface(surf)["status"]
            if st != "present" and not args.force_connectors:
                bad.append(f"{surf.get('id')}={st}")
        if bad and not args.force_connectors:
            print("REFUSED ship: ship_gate connectors not ready: " + ", ".join(bad), file=sys.stderr)
            print("(pass --force-connectors only after human review)", file=sys.stderr)
            return 4
    except Exception as e:
        print(f"connector check warn: {e}", file=sys.stderr)

    authority = t["authority"]
    task["status"] = "commit"
    task["result"] = args.result or f"ship-live authority={authority}"
    if args.sha:
        task["sha"] = args.sha
    task["shipped"] = {
        "at": _now(),
        "authority": authority,
        "acks": t["acks"],
        "voters": t["voters"],
        "by": normalize_voter(args.by),
    }
    task["updated"] = _now()
    state["last_ship"] = {
        "id": args.task_id,
        "authority": authority,
        "sha": task.get("sha") or "",
        "at": _now(),
        "result": task.get("result"),
    }
    bus.save_state(state)
    bus.feed_append(
        normalize_voter(args.by),
        f"SHIP {args.task_id} auth={authority} sha={task.get('sha') or '-'} {task.get('result')}",
        kind="commit",
        specialty=str(task.get("specialty") or "coord"),
    )
    print(json.dumps({"shipped": True, "task": args.task_id, "authority": authority, **{k: t[k] for k in ("acks", "nacks", "voters", "need")}}, indent=2))
    if authority == "unanimous" and policy.get("unanimous_authority"):
        print("authority=unanimous — full collegial authority to ship live")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Collegium ship-live majority gate")
    sub = p.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("vote", help="ack|nack a ship-live task")
    v.add_argument("task_id")
    v.add_argument("vote", choices=["ack", "nack"])
    v.add_argument("--by", required=True)
    v.add_argument("--note", default="")

    s = sub.add_parser("status", help="quorum tally")
    s.add_argument("task_id", nargs="?", default="")
    s.add_argument("--ship-only", action="store_true")

    m = sub.add_parser("mark", help="mark task as ship_live candidate")
    m.add_argument("task_id")
    m.add_argument("--by", default="hermes")

    sh = sub.add_parser("ship", help="ship live if majority ACK (no NACK)")
    sh.add_argument("task_id")
    sh.add_argument("--by", default="stratagrok")
    sh.add_argument("--result", default="")
    sh.add_argument("--sha", default="")
    sh.add_argument("--force-connectors", action="store_true")

    args = p.parse_args()
    if args.cmd == "vote":
        return cmd_vote(args)
    if args.cmd == "status":
        return cmd_status(args)
    if args.cmd == "mark":
        return cmd_mark(args)
    if args.cmd == "ship":
        return cmd_ship(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
