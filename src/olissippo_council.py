#!/usr/bin/env python3
"""Bandua war-band season — Diplomacy-like simultaneous orders (Phase 7 / 8A).

Hard rule: resolve_season is PURE (no bag mutation).
Pipeline: submit_order → close_season → resolve_season → apply_resolution.
Escort is generalized; river_escort is the Tagus lore instance.
"""
from __future__ import annotations

import json
from collections import defaultdict
from copy import deepcopy
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
    verbs = set(d["order_verbs"]) | {"escort"}  # generalized escort
    verb = order.get("verb")
    # lore instance maps to escort for validation of chain rules
    effective = "river_escort" if verb in ("river_escort", "escort") and order.get("chain") else verb
    unit = order.get("unit_id")
    loc = order.get("at")
    if not unit or not loc:
        return {"ok": False, "error": "missing_unit_or_at"}
    if verb not in verbs and verb != "escort":
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
    if effective == "river_escort" or verb in ("river_escort", "escort"):
        chain = order.get("chain") or []
        if chain:
            ok_chains = [tuple(c) for c in d.get("river_escort_chains", [])]
            if tuple(chain) not in ok_chains:
                return {"ok": False, "error": "invalid_escort_chain"}
    return {"ok": True, "order": order}


def resolve_season(orders: list[Order], data: dict[str, Any] | None = None) -> dict[str, Any]:
    """PURE simultaneous resolve: support adds strength; ties bounce; attacked supporters cut.

    Does not mutate any season bag. Call apply_resolution to write results.
    """
    d = data or load_diplomacy()
    validated = []
    for o in orders:
        v = validate_order(o, d)
        if not v.get("ok"):
            return {"ok": False, "error": "invalid_order", "detail": v}
        validated.append(deepcopy(o))

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
        verb = o["verb"]
        if verb == "hold":
            holds[uid] = o["at"]
        elif verb == "move":
            strength = 1 + support_for.get(uid, 0)
            movers[o["target"]].append((uid, strength))
        elif verb in ("river_escort", "escort"):
            holds[uid] = o["at"]  # escort unit stays; passenger resolved separately if present
        elif verb == "support":
            holds[uid] = o["at"]

    positions: dict[str, str] = {}
    for o in validated:
        positions[o["unit_id"]] = o["at"]

    bounced: list[str] = []
    moved: list[dict[str, Any]] = []
    for dest, contenders in movers.items():
        # defender strength: unit holding dest
        defenders = [
            (uid, 1 + support_for.get(uid, 0))
            for uid, loc in positions.items()
            if loc == dest and uid not in [c[0] for c in contenders]
        ]
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
        "pure": True,
    }


def new_season_bag() -> dict[str, Any]:
    return {
        "season": 0,
        "orders": [],
        "closed": False,
        "last_resolution": None,
        "positions": {},
    }


def submit_order(bag: dict[str, Any], order: Order) -> dict[str, Any]:
    """Queue a sealed order into the season bag (mutates bag)."""
    if bag.get("closed"):
        return {"ok": False, "error": "season_closed"}
    v = validate_order(order)
    if not v.get("ok"):
        return v
    bag.setdefault("orders", []).append(deepcopy(order))
    return {"ok": True, "order": order, "queued": len(bag["orders"])}


def close_season(bag: dict[str, Any]) -> dict[str, Any]:
    """Close order collection; ready for pure resolve + apply."""
    if bag.get("closed"):
        return {"ok": False, "error": "already_closed"}
    bag["closed"] = True
    return {"ok": True, "season": bag.get("season", 0), "order_count": len(bag.get("orders") or [])}


def apply_resolution(bag: dict[str, Any], resolution: dict[str, Any]) -> dict[str, Any]:
    """Write pure resolve_season output onto the season bag (and optional council bag)."""
    if not resolution.get("ok"):
        return {"ok": False, "error": "bad_resolution"}
    # season sub-bag may live at bag["bandua"] or bag itself
    season_bag = bag.setdefault("bandua", bag if "orders" in bag else new_season_bag())
    if season_bag is bag and "orders" not in bag:
        bag.setdefault("orders", [])
        season_bag = bag

    target = bag.get("bandua") if isinstance(bag.get("bandua"), dict) else bag
    target["last_resolution"] = deepcopy(resolution)
    target["positions"] = dict(resolution.get("positions") or {})
    target["closed"] = False
    target["orders"] = []
    target["season"] = int(target.get("season") or 0) + 1
    bag["bandua_last"] = deepcopy(resolution)
    bag["season"] = target["season"]
    return {"ok": True, "season": target["season"], "positions": target["positions"]}
