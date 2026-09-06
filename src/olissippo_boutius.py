#!/usr/bin/env python3
"""Olissippo Phase 2 — deterministic Boutius (ACB Subject, not NFT).

No LLM. Server-authoritative actions via olissippo_world.validate_move.
Boutius is Subject.kind=acb — never Object / object_id / NFT.
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import olissippo_world as ow

ROOT = Path(__file__).resolve().parents[1]
PERSONA_PATH = ROOT / "contracts" / "mud" / "olissippo-persona-boutius.json"

# game minutes from midnight → (activity, preferred_location)
# Matches lore prospectus rhythm, Lusitanian forge day.
ROUTINE: list[tuple[int, str, str]] = [
    (0, "sleep", "smithy"),       # overnight at forge shed
    (6 * 60, "wake", "smithy"),
    (7 * 60, "eat", "guest_house"),
    (8 * 60, "work", "smithy"),
    (12 * 60, "eat", "guest_house"),
    (13 * 60, "work", "smithy"),
    (16 * 60, "fetch_charcoal", "charcoal_lean"),
    (16 * 60 + 20, "work", "smithy"),
    (18 * 60, "close_shop", "smithy"),
    (19 * 60, "socialize", "market"),
    (22 * 60, "sleep", "smithy"),
]


def load_persona() -> dict[str, Any]:
    data = json.loads(PERSONA_PATH.read_text())
    assert data["kind"] == "acb"
    assert data["subject_id"].startswith("acb-")
    assert "object_id" not in data
    return data


def activity_at(minute_of_day: int) -> tuple[str, str]:
    """Return (activity, location_id) for minute in [0, 1440)."""
    m = int(minute_of_day) % 1440
    current = ROUTINE[0]
    for start, act, loc in ROUTINE:
        if m >= start:
            current = (start, act, loc)
        else:
            break
    return current[1], current[2]


def initial_state(persona: dict[str, Any] | None = None) -> dict[str, Any]:
    p = persona or load_persona()
    return {
        "subject_id": p["subject_id"],
        "kind": "acb",  # Subject — never object/NFT
        "display_name": p["display_name"],
        "location_id": p.get("home_location") or "smithy",
        "activity": "sleep",
        "energy": 1.0,
        "hunger": 0.2,
        "charcoal_held": 0,
        "spear_progress": 0,  # 0..12 chefe order
        "primary_goal": p["primary_goal"],
        "day": 1,
        "minute": 0,
        "last_action": None,
        "log": [],
        # ontology seals
        "is_subject": True,
        "is_object": False,
        "is_nft": False,
    }


def _path(from_id: str, to_id: str) -> list[str] | None:
    """BFS next-hop list from→to inclusive of destination only as steps."""
    if from_id == to_id:
        return []
    adj = ow.adjacency()
    if from_id not in adj or to_id not in adj:
        return None
    from collections import deque
    q = deque([(from_id, [])])
    seen = {from_id}
    while q:
        cur, path = q.popleft()
        for nxt in adj[cur]:
            if nxt in seen:
                continue
            np = path + [nxt]
            if nxt == to_id:
                return np
            seen.add(nxt)
            q.append((nxt, np))
    return None



def _apply_activity(s: dict[str, Any], want_act: str) -> dict[str, Any]:
    """Apply activity at current location. Charcoal stays on Subject runtime — ACB ≠ NFT."""
    if want_act in ("fetch_charcoal", "need_charcoal") and s["location_id"] == "charcoal_lean":
        s["charcoal_held"] = min(10, int(s["charcoal_held"]) + 2)
        s["last_action"] = {"type": "buy", "item": "charcoal", "quantity": 2, "ok": True}
    elif want_act == "work" and s["location_id"] == "smithy":
        if s["charcoal_held"] > 0:
            s["charcoal_held"] -= 1
            s["spear_progress"] = min(12, int(s["spear_progress"]) + 1)
            s["last_action"] = {"type": "work", "ok": True, "spear_progress": s["spear_progress"]}
        else:
            s["activity"] = "need_charcoal"
            s["last_action"] = {"type": "wait", "reason": "no_charcoal"}
    elif want_act == "eat":
        s["hunger"] = max(0.0, float(s["hunger"]) - 0.3)
        s["last_action"] = {"type": "eat", "ok": True}
    elif want_act == "sleep":
        s["energy"] = min(1.0, float(s["energy"]) + 0.2)
        s["last_action"] = {"type": "sleep", "ok": True}
    elif want_act in ("wake", "close_shop", "socialize"):
        s["last_action"] = {"type": "wait", "activity": want_act}
    else:
        s["last_action"] = {"type": "wait", "activity": want_act}
    return s


def tick(state: dict[str, Any], minutes: int = 10) -> dict[str, Any]:
    """Advance Boutius by `minutes` of game time. Deterministic; no LLM."""
    s = deepcopy(state)
    assert s.get("kind") == "acb"
    assert s.get("is_nft") is False
    assert s.get("is_object") is False
    assert "object_id" not in s

    s["minute"] = (int(s["minute"]) + int(minutes)) % 1440
    if int(state["minute"]) + int(minutes) >= 1440:
        s["day"] = int(s["day"]) + 1

    want_act, want_loc = activity_at(s["minute"])
    s["activity"] = want_act

    # If working but out of charcoal, divert to lean-to (still Subject inventory — not NFT mint)
    if want_act == "work" and int(s["charcoal_held"]) <= 0:
        want_act, want_loc = "fetch_charcoal", "charcoal_lean"
        s["activity"] = "need_charcoal"

    # move one hop toward target if needed
    if s["location_id"] != want_loc:
        path = _path(s["location_id"], want_loc)
        if path:
            nxt = path[0]
            check = ow.validate_move(s["location_id"], nxt)
            if check.get("ok"):
                s["location_id"] = nxt
                s["last_action"] = {"type": "move", "destination": nxt, "ok": True}
                # if this hop arrives at target, also apply activity same tick
                if nxt == want_loc:
                    s = _apply_activity(s, want_act)
                s["log"].append({"day": s["day"], "minute": s["minute"], "action": s["last_action"]})
                return s
            s["last_action"] = {"type": "move", "destination": nxt, "ok": False, "error": check.get("error")}
            s["log"].append({"day": s["day"], "minute": s["minute"], "action": s["last_action"]})
            return s
        s["last_action"] = {"type": "wait", "reason": "no_path"}
        s["log"].append({"day": s["day"], "minute": s["minute"], "action": s["last_action"]})
        return s

    # at target — activity effects
    s = _apply_activity(s, want_act)

    # light metabolism
    s["hunger"] = min(1.0, float(s["hunger"]) + 0.02)
    s["energy"] = max(0.0, float(s["energy"]) - 0.01)
    s["log"].append({"day": s["day"], "minute": s["minute"], "action": s["last_action"]})
    # cap log
    s["log"] = s["log"][-200:]
    return s


def run_until(state: dict[str, Any], ticks: int, minutes_per_tick: int = 10) -> dict[str, Any]:
    s = state
    for _ in range(int(ticks)):
        s = tick(s, minutes_per_tick)
    return s


def assert_subject_not_nft(state: dict[str, Any]) -> None:
    if state.get("kind") != "acb":
        raise AssertionError("Boutius must be kind=acb Subject")
    if state.get("is_nft") or state.get("is_object"):
        raise AssertionError("ACB ≠ NFT / Object")
    if "object_id" in state:
        raise AssertionError("Subject state must not carry object_id")
