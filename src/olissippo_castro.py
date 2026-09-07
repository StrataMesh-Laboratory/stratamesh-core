#!/usr/bin/env python3
"""Castro hearth cycle — Travian/FoE-like settle/expand/raid/production (Phase 7b).

Lore: Ciclo do castro. Mechanics only; no product branding.
Castros are runtime settlements (claims), not NFTs. Subjects may hold them.
"""
from __future__ import annotations

import json
import math
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "contracts" / "mud" / "olissippo-castro-settlement.json"

try:
    import olissippo_neighbours as nb
except ImportError:  # pragma: no cover
    nb = None  # type: ignore


@lru_cache(maxsize=1)
def load_castro() -> dict[str, Any]:
    data = json.loads(PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    return data


def new_state(data: dict[str, Any] | None = None) -> dict[str, Any]:
    d = data or load_castro()
    castros = {c["castro_id"]: deepcopy(c) for c in d["castro_seeds"]}
    return {
        "castros": castros,
        "by_territory": {c["territory_id"]: cid for cid, c in castros.items()},
        "tick": 0,
        "log": [],
    }


def _work_defs(d: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {w["id"]: w for w in d["works"]}


def defense_of(castro: dict[str, Any], d: dict[str, Any] | None = None) -> int:
    d = d or load_castro()
    defs = _work_defs(d)
    total = int(d["raid"]["defense_base"])
    for wid, lvl in (castro.get("works") or {}).items():
        w = defs.get(wid) or {}
        total += int(w.get("defense_per_level") or 0) * int(lvl or 0)
    return total


def production_rates(castro: dict[str, Any], d: dict[str, Any] | None = None) -> dict[str, int]:
    d = d or load_castro()
    defs = _work_defs(d)
    rates: dict[str, int] = {r["id"]: 0 for r in d["resources"]}
    for wid, lvl in (castro.get("works") or {}).items():
        w = defs.get(wid) or {}
        prod = w.get("produces")
        if prod:
            rates[prod] = rates.get(prod, 0) + int(w.get("rate_per_level") or 0) * int(lvl or 0)
    return rates


def tick_production(state: dict[str, Any], castro_id: str | None = None) -> dict[str, Any]:
    """Add one season of production to one castro or all."""
    d = load_castro()
    ids = [castro_id] if castro_id else list(state["castros"].keys())
    out = {}
    for cid in ids:
        c = state["castros"].get(cid)
        if not c:
            return {"ok": False, "error": "unknown_castro", "castro_id": cid}
        rates = production_rates(c, d)
        res = c.setdefault("resources", {})
        for k, v in rates.items():
            res[k] = int(res.get(k, 0)) + int(v)
        out[cid] = {"added": rates, "resources": dict(res)}
    state["tick"] = int(state.get("tick") or 0) + 1
    state.setdefault("log", []).append({"verb": "tick_production", "castros": list(out)})
    return {"ok": True, "tick": state["tick"], "results": out}


def _upgrade_cost(level: int, d: dict[str, Any]) -> dict[str, int]:
    base = d["upgrade"]["base_cost"]
    mult = float(d["upgrade"]["cost_per_level_mult"]) ** max(level, 0)
    return {k: int(math.ceil(v * mult)) for k, v in base.items()}


def upgrade_work(state: dict[str, Any], castro_id: str, work_id: str) -> dict[str, Any]:
    d = load_castro()
    c = state["castros"].get(castro_id)
    if not c:
        return {"ok": False, "error": "unknown_castro"}
    defs = _work_defs(d)
    if work_id not in defs:
        return {"ok": False, "error": "unknown_work"}
    works = c.setdefault("works", {})
    cur = int(works.get(work_id) or 0)
    mx = int(defs[work_id].get("max_level") or 10)
    if cur >= mx:
        return {"ok": False, "error": "max_level"}
    cost = _upgrade_cost(cur, d)
    res = c.setdefault("resources", {})
    for k, need in cost.items():
        if int(res.get(k, 0)) < need:
            return {"ok": False, "error": "insufficient_resources", "need": cost, "have": dict(res)}
    for k, need in cost.items():
        res[k] = int(res[k]) - need
    works[work_id] = cur + 1
    # population soft bump on enclosure upgrades
    if work_id == "enclosure":
        c["population"] = int(c.get("population") or 0) + 5
    state.setdefault("log", []).append({"verb": "upgrade_work", "castro_id": castro_id, "work": work_id, "to": cur + 1})
    return {"ok": True, "work_id": work_id, "level": cur + 1, "paid": cost, "mechanic": "castro_hearth"}


def plant_castro(
    state: dict[str, Any],
    source_castro_id: str,
    territory_id: str,
    new_castro_id: str | None = None,
) -> dict[str, Any]:
    """Expand: found a new castro on an empty/scrub site (Travian settle analogue)."""
    d = load_castro()
    src = state["castros"].get(source_castro_id)
    if not src:
        return {"ok": False, "error": "unknown_source"}
    if territory_id in state.get("by_territory", {}):
        return {"ok": False, "error": "territory_occupied"}
    sites = {s["territory_id"]: s for s in d.get("empty_plant_sites") or []}
    site = sites.get(territory_id)
    if not site:
        return {"ok": False, "error": "not_plantable"}
    if site.get("kind") not in (d["expand"].get("plantable_kinds") or []):
        return {"ok": False, "error": "bad_site_kind"}
    if d["expand"].get("require_adjacent"):
        src_terr = src["territory_id"]
        adj_ok = src_terr in (site.get("adjacent_to") or [])
        if not adj_ok and nb is not None:
            adj_ok = nb.can_move(src_terr, territory_id)
        if not adj_ok:
            return {"ok": False, "error": "not_adjacent"}
    if int(src.get("population") or 0) < int(d["expand"]["min_source_population"]):
        return {"ok": False, "error": "population_low"}
    cost = d["expand"]["cost"]
    res = src.setdefault("resources", {})
    for k, need in cost.items():
        if int(res.get(k, 0)) < need:
            return {"ok": False, "error": "insufficient_resources", "need": cost, "have": dict(res)}
    for k, need in cost.items():
        res[k] = int(res[k]) - need
    src["population"] = int(src["population"]) - 20
    seed = deepcopy(d["expand"]["new_castro_seed"])
    cid = new_castro_id or f"castro-{territory_id}"
    if cid in state["castros"]:
        return {"ok": False, "error": "castro_id_taken"}
    new_c = {
        "castro_id": cid,
        "territory_id": territory_id,
        "people_id": src["people_id"],
        "holder_subject": src.get("holder_subject"),
        "population": seed["population"],
        "resources": seed["resources"],
        "works": seed["works"],
        "founded_from": source_castro_id,
    }
    state["castros"][cid] = new_c
    state.setdefault("by_territory", {})[territory_id] = cid
    # remove from plantable conceptually by occupation only
    state.setdefault("log", []).append({"verb": "plant_castro", "from": source_castro_id, "to": cid, "territory": territory_id})
    return {"ok": True, "castro": new_c, "mechanic": "castro_hearth"}


def cattle_raid(
    state: dict[str, Any],
    attacker_id: str,
    defender_id: str,
    band_size: int,
) -> dict[str, Any]:
    """Raid: lift a fraction of defender resources if attack power beats defense."""
    d = load_castro()
    att = state["castros"].get(attacker_id)
    defn = state["castros"].get(defender_id)
    if not att or not defn:
        return {"ok": False, "error": "unknown_castro"}
    if attacker_id == defender_id:
        return {"ok": False, "error": "self_raid"}
    if band_size < int(d["raid"]["min_attacker_band"]):
        return {"ok": False, "error": "band_too_small"}
    cost = int(d["raid"]["cost_band"])
    ares = att.setdefault("resources", {})
    if int(ares.get("grain", 0)) < cost:
        return {"ok": False, "error": "insufficient_grain_for_band"}
    ares["grain"] = int(ares["grain"]) - cost
    atk_power = band_size + int(att.get("works", {}).get("watch_post") or 0)
    defense = defense_of(defn, d)
    if atk_power <= defense:
        state.setdefault("log", []).append({"verb": "cattle_raid", "result": "repelled", "attacker": attacker_id, "defender": defender_id})
        return {"ok": True, "result": "repelled", "attack": atk_power, "defense": defense, "loot": {}}
    frac = float(d["raid"]["loot_fraction"])
    dres = defn.setdefault("resources", {})
    loot: dict[str, int] = {}
    for k in ("herd", "grain", "timber", "ore"):
        take = int(int(dres.get(k, 0)) * frac)
        if take > 0:
            dres[k] = int(dres[k]) - take
            ares[k] = int(ares.get(k, 0)) + take
            loot[k] = take
    state.setdefault("log", []).append({"verb": "cattle_raid", "result": "looted", "loot": loot})
    return {"ok": True, "result": "looted", "attack": atk_power, "defense": defense, "loot": loot, "mechanic": "castro_hearth"}


def reinforce(state: dict[str, Any], castro_id: str, grain: int = 10) -> dict[str, Any]:
    """Spend grain to raise population (FoE happiness/population soft analogue)."""
    c = state["castros"].get(castro_id)
    if not c:
        return {"ok": False, "error": "unknown_castro"}
    if grain <= 0:
        return {"ok": False, "error": "bad_grain"}
    res = c.setdefault("resources", {})
    if int(res.get("grain", 0)) < grain:
        return {"ok": False, "error": "insufficient_resources"}
    res["grain"] = int(res["grain"]) - grain
    gained = max(1, grain // 5)
    c["population"] = int(c.get("population") or 0) + gained
    return {"ok": True, "population": c["population"], "spent_grain": grain}
