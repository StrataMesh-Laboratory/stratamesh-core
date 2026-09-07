#!/usr/bin/env python3
"""Olissippo lore world — Phase 1 location graph + seed objects (not main)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
WORLD_PATH = ROOT / "contracts" / "mud" / "olissippo-world.json"


@lru_cache(maxsize=1)
def load_world() -> dict[str, Any]:
    data = json.loads(WORLD_PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    assert data.get("not_main") is True
    return data


def location_ids(world: dict[str, Any] | None = None) -> set[str]:
    w = world or load_world()
    return {loc["id"] for loc in w["locations"]}


def adjacency(world: dict[str, Any] | None = None) -> dict[str, set[str]]:
    w = world or load_world()
    adj: dict[str, set[str]] = {lid: set() for lid in location_ids(w)}
    for a, b in w["edges"]:
        if a not in adj or b not in adj:
            raise ValueError(f"edge references unknown location: {a!r}->{b!r}")
        adj[a].add(b)
        adj[b].add(a)
    return adj


def can_move(from_id: str, to_id: str, world: dict[str, Any] | None = None) -> bool:
    adj = adjacency(world)
    return from_id in adj and to_id in adj[from_id]


def validate_move(from_id: str, to_id: str, world: dict[str, Any] | None = None) -> dict[str, Any]:
    """Server-authoritative move check — LLM may only *intend* move."""
    w = world or load_world()
    ids = location_ids(w)
    if from_id not in ids:
        return {"ok": False, "error": "unknown_from", "from": from_id, "to": to_id}
    if to_id not in ids:
        return {"ok": False, "error": "unknown_to", "from": from_id, "to": to_id}
    if not can_move(from_id, to_id, w):
        return {"ok": False, "error": "not_adjacent", "from": from_id, "to": to_id}
    return {"ok": True, "from": from_id, "to": to_id, "action": "move"}


def objects_at(location_id: str, world: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    w = world or load_world()
    return [o for o in w.get("seed_objects", []) if o.get("location_id") == location_id]


def action_allowed(verb: str, world: dict[str, Any] | None = None) -> bool:
    w = world or load_world()
    return verb in set(w.get("actions_mundane", [])) | set(w.get("actions_magic", [])) | set(w.get("actions_council", []))


def numen_at(location_id: str, world: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    w = world or load_world()
    return [n for n in w.get("numen_hooks", []) if location_id in n.get("locations", [])]
