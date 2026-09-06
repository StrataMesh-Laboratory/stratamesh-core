#!/usr/bin/env python3
"""Olissippo Iberian neighbour territories — Phase 7 map layer."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "contracts" / "mud" / "olissippo-iberia-neighbours.json"


@lru_cache(maxsize=1)
def load_neighbours() -> dict[str, Any]:
    data = json.loads(PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    return data


def territory_ids(data: dict[str, Any] | None = None) -> set[str]:
    d = data or load_neighbours()
    return {t["id"] for t in d["territories"]}


def adjacency(data: dict[str, Any] | None = None) -> dict[str, set[str]]:
    d = data or load_neighbours()
    ids = territory_ids(d)
    adj: dict[str, set[str]] = {i: set() for i in ids}
    for a, b in d["edges"]:
        if a not in ids or b not in ids:
            raise ValueError(f"bad edge {a}->{b}")
        adj[a].add(b)
        adj[b].add(a)
    return adj


def can_move(a: str, b: str, data: dict[str, Any] | None = None) -> bool:
    return b in adjacency(data).get(a, set())


def supply_centers(data: dict[str, Any] | None = None) -> set[str]:
    d = data or load_neighbours()
    return {t["id"] for t in d["territories"] if t.get("supply")}


def people_ids(data: dict[str, Any] | None = None) -> set[str]:
    d = data or load_neighbours()
    return {p["id"] for p in d["peoples"]}
