#!/usr/bin/env python3
"""Olissippo Phase 5 — five opening ACB personas (ACB ≠ NFT).

Loads PersonaLore JSON; light deterministic routines per role.
All are Subject.kind=acb — never Object / object_id / NFT.
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import olissippo_boutius as bb
import olissippo_identity as oid
import olissippo_world as ow

ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "contracts" / "mud" / "olissippo-personas.json"
MUD = ROOT / "contracts" / "mud"

# role → (minute_start, activity, location_id)*
ROUTINES: dict[str, list[tuple[int, str, str]]] = {
    "smith": bb.ROUTINE,
    "guest_house_keeper": [
        (0, "sleep", "guest_house"),
        (6 * 60, "wake", "guest_house"),
        (7 * 60, "work", "guest_house"),
        (10 * 60, "market_supplies", "market"),
        (11 * 60, "work", "guest_house"),
        (14 * 60, "work", "guest_house"),
        (18 * 60, "socialize", "guest_house"),
        (22 * 60, "sleep", "guest_house"),
    ],
    "forge_apprentice": [
        (0, "sleep", "apprentice_yard"),
        (6 * 60, "wake", "apprentice_yard"),
        (7 * 60, "eat", "guest_house"),
        (8 * 60, "work", "smithy"),
        (12 * 60, "eat", "guest_house"),
        (13 * 60, "fetch_charcoal", "charcoal_lean"),
        (14 * 60, "work", "smithy"),
        (18 * 60, "work", "apprentice_yard"),
        (21 * 60, "sleep", "apprentice_yard"),
    ],
    "wall_watch": [
        (0, "patrol", "wall_watch"),
        (4 * 60, "sleep", "wall_watch"),
        (8 * 60, "patrol", "wall_watch"),
        (12 * 60, "eat", "guest_house"),
        (13 * 60, "patrol", "hill_enclosure"),
        (16 * 60, "patrol", "wall_watch"),
        (19 * 60, "socialize", "market"),
        (21 * 60, "patrol", "wall_watch"),
    ],
    "river_trader": [
        (0, "sleep", "quay"),
        (6 * 60, "wake", "quay"),
        (7 * 60, "trade", "quay"),
        (10 * 60, "trade", "market"),
        (13 * 60, "eat", "guest_house"),
        (14 * 60, "trade", "quay"),
        (17 * 60, "trade", "market"),
        (20 * 60, "socialize", "quay"),
        (22 * 60, "sleep", "quay"),
    ],
}


def load_index() -> dict[str, Any]:
    return json.loads(INDEX_PATH.read_text())


def load_persona(slug: str) -> dict[str, Any]:
    idx = load_index()
    entry = next((p for p in idx["personas"] if p["slug"] == slug), None)
    if not entry:
        raise KeyError(f"unknown_persona:{slug}")
    data = json.loads((MUD / entry["file"]).read_text())
    assert data["kind"] == "acb"
    assert "object_id" not in data
    data["subject_id"] = oid.resolve_subject_id(data["subject_id"])
    assert data["subject_id"] == entry["subject_id"]
    assert data.get("identity_registry") == "stratamesh"
    assert data.get("world_role_registry") == "cmn"
    assert data.get("world_role_id") == entry.get("world_role_id")
    # role fields come from CMN world role; identity does not own them
    role = oid.load_world_role(data["world_role_id"])
    assert role["subject_id"] == data["subject_id"]
    data["role"] = role["role"]
    data["home_location"] = role["home_location"]
    data["primary_goal"] = role["primary_goal"]
    return data


def all_personas() -> list[dict[str, Any]]:
    return [load_persona(p["slug"]) for p in load_index()["personas"]]


def activity_at(role: str, minute_of_day: int) -> tuple[str, str]:
    routine = ROUTINES.get(role) or ROUTINES["smith"]
    m = int(minute_of_day) % 1440
    current = routine[0]
    for start, act, loc in routine:
        if m >= start:
            current = (start, act, loc)
        else:
            break
    return current[1], current[2]


def initial_state(persona: dict[str, Any]) -> dict[str, Any]:
    return {
        "subject_id": persona["subject_id"],
        "kind": "acb",
        "display_name": persona["display_name"],
        "role": persona["role"],
        "location_id": persona.get("home_location") or "hill_enclosure",
        "activity": "sleep",
        "energy": 1.0,
        "hunger": 0.2,
        "charcoal_held": 0,
        "spear_progress": 0,
        "primary_goal": persona["primary_goal"],
        "day": 1,
        "minute": 0,
        "last_action": None,
        "log": [],
        "is_subject": True,
        "is_object": False,
        "is_nft": False,
    }


def _apply_role_activity(s: dict[str, Any], want_act: str) -> dict[str, Any]:
    role = s.get("role") or "smith"
    if role in ("smith", "forge_apprentice") and want_act in ("fetch_charcoal", "work", "eat", "sleep"):
        return bb._apply_activity(s, want_act)
    if want_act == "eat":
        s["hunger"] = max(0.0, float(s.get("hunger") or 0) - 0.3)
        s["last_action"] = {"type": "eat", "ok": True}
    elif want_act == "sleep":
        s["energy"] = min(1.0, float(s.get("energy") or 0) + 0.2)
        s["last_action"] = {"type": "sleep", "ok": True}
    elif want_act in ("trade", "market_supplies", "socialize", "patrol", "work", "wake"):
        s["last_action"] = {"type": "wait" if want_act == "wake" else ("inspect" if want_act == "patrol" else "say"), "ok": True, "activity": want_act}
        if want_act == "patrol":
            s["last_action"] = {"type": "inspect", "ok": True, "activity": "patrol"}
        elif want_act in ("trade", "market_supplies"):
            s["last_action"] = {"type": "buy", "item": "supplies", "quantity": 1, "ok": True, "activity": want_act}
        elif want_act == "socialize":
            s["last_action"] = {"type": "say", "ok": True, "activity": "socialize"}
        elif want_act == "work":
            s["last_action"] = {"type": "work", "ok": True, "activity": role}
    else:
        s["last_action"] = {"type": "wait", "ok": True, "activity": want_act}
    return s


def tick(state: dict[str, Any], minutes: int = 10) -> dict[str, Any]:
    """Deterministic role tick — ACB Subject seals preserved."""
    s = deepcopy(state)
    bb.assert_subject_not_nft(s)
    role = s.get("role") or "smith"
    s["minute"] = (int(s["minute"]) + int(minutes)) % 1440
    if int(state["minute"]) + int(minutes) >= 1440:
        s["day"] = int(s["day"]) + 1
    want_act, want_loc = activity_at(role, int(s["minute"]))
    s["activity"] = want_act
    if s["location_id"] != want_loc:
        path = bb._path(s["location_id"], want_loc) or []
        if path:
            check = ow.validate_move(s["location_id"], path[0])
            if check.get("ok"):
                s["location_id"] = path[0]
                s["last_action"] = {"type": "move", "destination": path[0], "ok": True}
                if path[0] == want_loc:
                    s = _apply_role_activity(s, want_act)
        else:
            s["last_action"] = {"type": "wait", "reason": "no_path"}
    else:
        s = _apply_role_activity(s, want_act)
    s["kind"] = "acb"
    s["is_subject"] = True
    s["is_object"] = False
    s["is_nft"] = False
    s.pop("object_id", None)
    s["log"] = list(s.get("log") or [])
    s["log"].append({"day": s.get("day"), "minute": s.get("minute"), "action": s["last_action"]})
    s["log"] = s["log"][-200:]
    return s


def tick_all(minutes: int = 10, days_hours: float = 2.0) -> dict[str, list[dict[str, Any]]]:
    """Advance every persona for N hours; prove autonomy without player."""
    steps = int((days_hours * 60) // minutes)
    out: dict[str, list[dict[str, Any]]] = {}
    for p in all_personas():
        st = initial_state(p)
        trail = [deepcopy(st)]
        for _ in range(steps):
            st = tick(st, minutes)
            trail.append(deepcopy(st))
        out[p["subject_id"]] = trail
    return out
