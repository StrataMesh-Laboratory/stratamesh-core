#!/usr/bin/env python3
"""Bandua war-band season — Diplomacy-like simultaneous orders (Phase 7)."""
from __future__ import annotations

import json
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any

import olissippo_neighbours as nb

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "contracts" / "mud" / "olissippo-council-diplomacy.json"

Order = dict[str, Any]


@lru_cache(maxsize=1)
def load_diplomacy() -> dict[str, Any]:
    data = json.loads(PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    return data


def validate_order(order: Order, data: dict[str, Any] | None = None) -> dict[str, Any]:
    """Validate one sealed order. Fields: unit_id, power_id, verb, target?, support_for?"""
    d = data or load_diplomacy()
    verbs = set(d["order_verbs"])
    verb = order.get("verb")
    unit = order.get("unit_id")
    loc = order.get("at")
    if not unit or not loc:
        return {"ok": False, "error": "missing_unit_or_at"}
    if verb not in verbs:
        return {"ok": False, "error": "unknown_verb", "verb": verb}
    ids = nb.territory_ids()
    if loc not in ids:
        return {"ok": False, "error": "unknown_location", "at": loc}
    if verb == "move":
        dest = order.get("target")
        if not dest or dest not in ids:
            return {"ok": False, "error": "bad_target"}
        if not nb.can_move(loc, dest):
            return {"ok": False, "error": "not_adjacent", "from": loc, "to": dest}
    if verb == "support":
        if not order.get("support_for"):
            return {"ok": False, "error": "missing_support_for"}
        dest = order.get("target")
        if dest and dest not in ids:
            return {"ok": False, "error": "bad_support_target"}
    if verb == "river_escort":
        chain = order.get("chain") or []
        ok_chains = [tuple(c) for c in d.get("river_escort_chains", [])]
        if tuple(chain) not in ok_chains:
            return {"ok": False, "error": "invalid_escort_chain"}
    return {"ok": True, "order": order}


def resolve_season(orders: list[Order], data: dict[str, Any] | None = None) -> dict[str, Any]:
    """Simultaneous resolve: support adds strength; ties bounce; attacked supporters cut."""
    d = data or load_diplomacy()
    validated = []
    for o in orders:
        v = validate_order(o, d)
        if not v.get("ok"):
            return {"ok": False, "error": "invalid_order", "detail": v}
        validated.append(o)

    # who is attacked (move targeting their location)
    attacked: set[str] = set()
    for o in validated:
        if o["verb"] == "move":
            attacked.add(o["target"])

    # effective support: cut if supporter's `at` is attacked
    support_for: dict[str, int] = defaultdict(int)
    for o in validated:
        if o["verb"] == "support":
            if d["resolution"].get("cut_support_if_attacked") and o["at"] in attacked:
                continue
            support_for[o["support_for"]] += int(d["resolution"].get("support_adds", 1))

    # move contests per destination
    movers: dict[str, list[tuple[str, int]]] = defaultdict(list)
    holds: dict[str, str] = {}
    for o in validated:
        uid = o["unit_id"]
        if o["verb"] == "hold":
            holds[uid] = o["at"]
        elif o["verb"] == "move":
            strength = 1 + support_for.get(uid, 0)
            movers[o["target"]].append((uid, strength))
        elif o["verb"] == "river_escort":
            holds[uid] = o["at"]  # escort unit stays; passenger resolved separately if present
        elif o["verb"] == "support":
            holds[uid] = o["at"]

    positions: dict[str, str] = {}
    for o in validated:
        positions[o["unit_id"]] = o["at"]

    bounced: list[str] = []
    moved: list[dict[str, str]] = []
    for dest, contenders in movers.items():
        # defender strength: unit holding dest
        defenders = [(uid, 1 + support_for.get(uid, 0)) for uid, loc in positions.items() if loc == dest and uid not in [c[0] for c in contenders]]
        best = max(contenders, key=lambda x: x[1])
        tied = [c for c in contenders if c[1] == best[1]]
        def_str = max((s for _, s in defenders), default=0)
        if len(tied) > 1 or (d["resolution"].get("bounce_on_tie") and best[1] <= def_str):
            bounced.extend([c[0] for c in contenders])
            continue
        if best[1] > def_str:
            positions[best[0]] = dest
            moved.append({"unit_id": best[0], "to": dest, "strength": best[1]})
            for c in contenders:
                if c[0] != best[0]:
                    bounced.append(c[0])
        else:
            bounced.extend([c[0] for c in contenders])

    return {
        "ok": True,
        "positions": positions,
        "moved": moved,
        "bounced": bounced,
        "mechanic": "bandua_war_band_season",
    }
