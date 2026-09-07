#!/usr/bin/env python3
"""Hill stirps — CK-like family/dynasty mechanics adapted to Lusitanian lore (Phase 7)."""
from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "contracts" / "mud" / "olissippo-kin-dynasty.json"


@lru_cache(maxsize=1)
def load_kin() -> dict[str, Any]:
    data = json.loads(PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    return data


def new_state(data: dict[str, Any] | None = None) -> dict[str, Any]:
    d = data or load_kin()
    return {
        "stirps": deepcopy(d["stirps_seed"]),
        "persons": {p["person_id"]: deepcopy(p) for p in d["person_seeds"]},
        "edges": [],
        "holdings": {
            "terr-olissippo": {"kind": "chefe_claim", "holder_person_id": "kin-oli-chefe-eldest", "stirps_id": "stirps-oli-chefe"},
            "terr-vetton-pastures": {"kind": "supply_claim", "holder_person_id": "kin-vetton-herd", "stirps_id": "stirps-vetton-cattle"},
        },
    }


def _person(state: dict[str, Any], pid: str) -> dict[str, Any] | None:
    return state.get("persons", {}).get(pid)


def marry(state: dict[str, Any], a: str, b: str) -> dict[str, Any]:
    d = load_kin()
    pa, pb = _person(state, a), _person(state, b)
    if not pa or not pb:
        return {"ok": False, "error": "unknown_person"}
    if not pa.get("alive") or not pb.get("alive"):
        return {"ok": False, "error": "not_alive"}
    if d["marriage"].get("same_stirps_forbidden") and pa.get("stirps_id") == pb.get("stirps_id"):
        return {"ok": False, "error": "same_stirps"}
    edges = state.setdefault("edges", [])
    edges.append({"kind": "spouse_of", "a": a, "b": b})
    edges.append({"kind": "spouse_of", "a": b, "b": a})
    edges.append({"kind": "oath_kin", "a": pa["stirps_id"], "b": pb["stirps_id"]})
    return {"ok": True, "alliance": [pa["stirps_id"], pb["stirps_id"]], "mechanic": "hill_stirps"}


def children_of(state: dict[str, Any], parent_id: str) -> list[str]:
    out = []
    for pid, p in state.get("persons", {}).items():
        if parent_id in (p.get("parent_ids") or []) and p.get("alive"):
            out.append(pid)
    return sorted(out)


def succeed_holding(state: dict[str, Any], territory_id: str) -> dict[str, Any]:
    """Eldest living child inherits; else stirps eldest living."""
    d = load_kin()
    holding = state.get("holdings", {}).get(territory_id)
    if not holding:
        return {"ok": False, "error": "no_holding"}
    holder = holding["holder_person_id"]
    hp = _person(state, holder)
    if not hp:
        return {"ok": False, "error": "holder_missing"}
    # mark holder dead for succession event
    hp["alive"] = False
    kids = children_of(state, holder)
    heir = None
    if kids and d["succession"]["default"] == "eldest_living_child":
        # generation then person_id as stable stand-in for age
        kids_sorted = sorted(kids, key=lambda k: (state["persons"][k].get("generation", 99), k))
        heir = kids_sorted[0]
    if not heir:
        stirps = holding.get("stirps_id")
        candidates = [
            pid for pid, p in state["persons"].items()
            if p.get("stirps_id") == stirps and p.get("alive")
        ]
        candidates.sort(key=lambda k: (state["persons"][k].get("generation", 99), k))
        heir = candidates[0] if candidates else None
    if not heir:
        return {"ok": False, "error": "no_heir"}
    holding["holder_person_id"] = heir
    state.setdefault("edges", []).append({"kind": "child_of", "a": heir, "b": holder})
    return {"ok": True, "territory_id": territory_id, "heir": heir, "from": holder}


def acknowledge_heir(state: dict[str, Any], parent_id: str, child_id: str) -> dict[str, Any]:
    parent = _person(state, parent_id)
    child = _person(state, child_id)
    if not parent or not child:
        return {"ok": False, "error": "unknown_person"}
    if parent.get("stirps_id") != child.get("stirps_id"):
        return {"ok": False, "error": "different_stirps"}
    parents = list(child.get("parent_ids") or [])
    if parent_id not in parents:
        parents.append(parent_id)
    child["parent_ids"] = parents
    state.setdefault("edges", []).append({"kind": "parent_of", "a": parent_id, "b": child_id})
    return {"ok": True, "parent": parent_id, "child": child_id}


def foster(state: dict[str, Any], child_id: str, host_person_id: str) -> dict[str, Any]:
    """CK-like fosterage — child guest under another stirps person (guest-right), not adoption/NFT."""
    child = _person(state, child_id)
    host = _person(state, host_person_id)
    if not child or not host:
        return {"ok": False, "error": "unknown_person"}
    if not child.get("alive") or not host.get("alive"):
        return {"ok": False, "error": "not_alive"}
    if child.get("stirps_id") == host.get("stirps_id"):
        return {"ok": False, "error": "same_stirps"}
    child["foster_host_id"] = host_person_id
    child["foster_stirps_id"] = host.get("stirps_id")
    state.setdefault("edges", []).append({"kind": "fostered_by", "a": child_id, "b": host_person_id})
    state.setdefault("edges", []).append({"kind": "guest_right", "a": child.get("stirps_id"), "b": host.get("stirps_id")})
    return {"ok": True, "child": child_id, "host": host_person_id, "mechanic": "hill_stirps"}

