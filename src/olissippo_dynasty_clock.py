#!/usr/bin/env python3
"""Dynasty clock — 1 real day = 1 game month (CK-style succession progression).

Server advances age_months; LLM never invents ages.
Succession laws come from HearthLaw policy (law_version), not hardcoded forever.
"""
from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "contracts" / "mud" / "olissippo-policy-layer.json"
WORLD = ROOT / "contracts" / "mud" / "olissippo-world.json"

import olissippo_kin as kin


@lru_cache(maxsize=1)
def load_policy() -> dict[str, Any]:
    return json.loads(POLICY.read_text())


@lru_cache(maxsize=1)
def load_world_clock() -> dict[str, Any]:
    w = json.loads(WORLD.read_text())
    return w.get("clock") or {}


def real_day_to_game_months() -> int:
    clock = load_world_clock()
    return int(clock.get("real_day_equals_game_months") or 1)


def succession_law(law_version: str | None = None, bag: dict[str, Any] | None = None) -> str:
    """Active succession law id from policy / bag override."""
    pol = load_policy()["policy"]
    if bag and bag.get("succession_resolve"):
        return str(bag["succession_resolve"])
    return str(pol.get("succession_policy", {}).get("resolve") or pol["defaults"]["succession_default"])


def _age(person: dict[str, Any]) -> int:
    return int(person.get("age_months") or 0)


def rank_heirs(
    state: dict[str, Any],
    parent_id: str,
    law: str,
) -> list[str]:
    """PURE — ordered eligible heirs under succession law."""
    kids = [pid for pid in kin.children_of(state, parent_id) if state["persons"].get(pid, {}).get("alive")]
    parent = state["persons"].get(parent_id) or {}
    if law == "designated_heir":
        des = parent.get("designated_heir_id")
        if des and state["persons"].get(des, {}).get("alive"):
            rest = [k for k in kids if k != des]
            rest.sort(key=lambda k: (_age(state["persons"][k]), k), reverse=True)
            return [des] + rest
        law = "eldest_living_child"
    if law == "youngest_living_child":
        kids.sort(key=lambda k: (_age(state["persons"][k]), k))
        return kids
    if law == "eldest_living_child":
        kids.sort(key=lambda k: (_age(state["persons"][k]), k), reverse=True)
        return kids
    if law in ("stirps_priority", "elective"):
        # elective stub: same as stirps eldest until vote engine lands
        stirps = parent.get("stirps_id")
        members = [
            pid for pid, p in state["persons"].items()
            if p.get("stirps_id") == stirps and p.get("alive") and pid != parent_id
        ]
        members.sort(key=lambda k: (_age(state["persons"][k]), k), reverse=True)
        return members
    kids.sort(key=lambda k: (_age(state["persons"][k]), k), reverse=True)
    return kids


def resolve_succession(
    state: dict[str, Any],
    territory_id: str,
    *,
    law: str | None = None,
    law_version: str | None = None,
) -> dict[str, Any]:
    """PURE plan: who inherits holding when current holder is dead/abdicating."""
    law = law or succession_law(law_version, state)
    holding = state.get("holdings", {}).get(territory_id)
    if not holding:
        return {"ok": False, "error": "no_holding", "pure": True}
    holder = holding["holder_person_id"]
    heirs = rank_heirs(state, holder, law)
    heir = heirs[0] if heirs else None
    if not heir:
        # fallback stirps
        heirs = rank_heirs(state, holder, "stirps_priority")
        heir = heirs[0] if heirs else None
        law = "stirps_priority"
    if not heir:
        return {"ok": False, "error": "no_heir", "pure": True, "law": law}
    return {
        "ok": True,
        "pure": True,
        "territory_id": territory_id,
        "from": holder,
        "heir": heir,
        "law": law,
        "reason": f"succession_law:{law}",
        "eligible": heirs,
    }


def apply_succession(state: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
    if not plan.get("ok"):
        return plan
    holding = state["holdings"][plan["territory_id"]]
    holding["holder_person_id"] = plan["heir"]
    state.setdefault("edges", []).append({
        "kind": "succeeded",
        "a": plan["heir"],
        "b": plan["from"],
        "territory_id": plan["territory_id"],
        "law": plan["law"],
    })
    return {"ok": True, "applied": plan}


def advance_game_month(
    kin_state: dict[str, Any],
    months: int = 1,
    *,
    law_version: str | None = None,
    max_age_months: int | None = None,
) -> dict[str, Any]:
    """Advance dynasty clock by N game months (default 1 = one real day).

    Ages all living persons; marks death at max_age; runs succession on holdings
    whose holder died this tick. PURE aging + returns events list; mutates kin_state.
    """
    if months < 1:
        return {"ok": False, "error": "bad_months"}
    pol = load_policy()["policy"]
    max_age = int(max_age_months if max_age_months is not None else pol["defaults"].get("max_age_months") or 70 * 12)
    law = succession_law(law_version, kin_state)
    deaths: list[str] = []
    for pid, person in kin_state.get("persons", {}).items():
        if not person.get("alive"):
            continue
        person["age_months"] = _age(person) + months
        if person["age_months"] >= max_age:
            person["alive"] = False
            deaths.append(pid)
    successions = []
    for terr, holding in list((kin_state.get("holdings") or {}).items()):
        holder = holding.get("holder_person_id")
        hp = kin_state["persons"].get(holder) or {}
        if holder in deaths or not hp.get("alive"):
            plan = resolve_succession(kin_state, terr, law=law, law_version=law_version)
            if plan.get("ok"):
                apply_succession(kin_state, plan)
                successions.append(plan)
    kin_state["game_month"] = int(kin_state.get("game_month") or 0) + months
    return {
        "ok": True,
        "months_advanced": months,
        "real_days_equivalent": months / max(real_day_to_game_months(), 1),
        "game_month": kin_state["game_month"],
        "deaths": deaths,
        "successions": successions,
        "law": law,
        "reason": "dynasty_tick_real_day_eq_game_month",
    }


def ensure_ages(kin_state: dict[str, Any]) -> None:
    for person in kin_state.get("persons", {}).values():
        if "age_months" not in person:
            # generation stand-in: gen0 ~ 50y, gen1 ~ 25y
            gen = int(person.get("generation") or 0)
            person["age_months"] = (50 - gen * 20) * 12



def player_dynasties(state: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Map player_dynasty_id -> meta (owner Subject: user or ACB)."""
    return dict(state.get("player_dynasties") or {})


def ensure_player_dynasty(
    state: dict[str, Any],
    dynasty_id: str,
    *,
    owner_subject_id: str,
    owner_kind: str = "acb",
    succession_law: str | None = None,
) -> dict[str, Any]:
    """Register a player dynasty. owner_kind: acb|user (EN); SCA is PT label only."""
    if owner_kind not in ("acb", "user"):
        return {"ok": False, "error": "bad_owner_kind", "note": "use acb (EN) or user; SCA is PT for acb"}
    if not owner_subject_id or str(owner_subject_id).startswith("obj-"):
        return {"ok": False, "error": "owner_must_be_subject"}
    law = succession_law or succession_law_default()
    pd = state.setdefault("player_dynasties", {})
    pd[dynasty_id] = {
        "dynasty_id": dynasty_id,
        "owner_subject_id": owner_subject_id,
        "owner_kind": owner_kind,  # acb | user
        "owner_label_pt": "SCA" if owner_kind == "acb" else "utilizador",
        "succession_law": law,
        "head_person_id": None,
    }
    return {"ok": True, "dynasty": pd[dynasty_id]}


def succession_law_default() -> str:
    return succession_law(None, None)


def dynasty_law(state: dict[str, Any], dynasty_id: str) -> str:
    d = (state.get("player_dynasties") or {}).get(dynasty_id) or {}
    return str(d.get("succession_law") or succession_law(None, state))


def set_dynasty_succession_law(state: dict[str, Any], dynasty_id: str, law: str) -> dict[str, Any]:
    """Nomic/Grove-style per-dynasty law change (typed)."""
    laws = set(load_policy()["policy"].get("succession_laws") or {})
    # also accept keys from succession_laws dict
    pol_laws = load_policy()["policy"].get("succession_laws") or {}
    if isinstance(pol_laws, dict):
        laws = set(pol_laws.keys())
    if law not in laws and law not in (
        "eldest_living_child", "youngest_living_child", "designated_heir", "elective", "stirps_priority"
    ):
        return {"ok": False, "error": "unknown_succession_law"}
    pd = state.setdefault("player_dynasties", {})
    if dynasty_id not in pd:
        return {"ok": False, "error": "unknown_dynasty"}
    before = pd[dynasty_id].get("succession_law")
    pd[dynasty_id]["succession_law"] = law
    return {"ok": True, "dynasty_id": dynasty_id, "from": before, "to": law, "reason": "nomic_dynasty_law"}


def heads_by_person(state: dict[str, Any]) -> dict[str, list[str]]:
    """person_id -> list of dynasty_ids they currently head."""
    out: dict[str, list[str]] = {}
    for did, d in (state.get("player_dynasties") or {}).items():
        head = d.get("head_person_id")
        if head:
            out.setdefault(head, []).append(did)
    return out


def assert_unique_dynasty_head(state: dict[str, Any], person_id: str, dynasty_id: str) -> dict[str, Any]:
    """Descendants of two players (ACB/user) cannot share the same successor leading both dynasties."""
    mapping = heads_by_person(state)
    others = [d for d in mapping.get(person_id, []) if d != dynasty_id]
    if others:
        return {
            "ok": False,
            "error": "shared_successor_forbidden",
            "person_id": person_id,
            "dynasty_id": dynasty_id,
            "already_heads": others,
            "note": "One living person cannot lead two player dynasties at once (ACB/SCA or user lines).",
        }
    return {"ok": True}


def set_dynasty_head(state: dict[str, Any], dynasty_id: str, person_id: str) -> dict[str, Any]:
    gate = assert_unique_dynasty_head(state, person_id, dynasty_id)
    if not gate.get("ok"):
        return gate
    pd = state.get("player_dynasties") or {}
    if dynasty_id not in pd:
        return {"ok": False, "error": "unknown_dynasty"}
    # clear person from other heads if somehow set
    for did, d in pd.items():
        if did != dynasty_id and d.get("head_person_id") == person_id:
            return {"ok": False, "error": "shared_successor_forbidden", "already_heads": [did]}
    pd[dynasty_id]["head_person_id"] = person_id
    return {"ok": True, "dynasty_id": dynasty_id, "head_person_id": person_id}


def apply_succession_to_dynasty(
    state: dict[str, Any],
    dynasty_id: str,
    territory_id: str,
) -> dict[str, Any]:
    """Resolve succession for a holding under that dynasty's own law; enforce unique head."""
    law = dynasty_law(state, dynasty_id)
    plan = resolve_succession(state, territory_id, law=law)
    if not plan.get("ok"):
        return plan
    heir = plan["heir"]
    gate = assert_unique_dynasty_head(state, heir, dynasty_id)
    if not gate.get("ok"):
        # try next eligible heirs
        for cand in plan.get("eligible") or []:
            if cand == heir:
                continue
            g2 = assert_unique_dynasty_head(state, cand, dynasty_id)
            if g2.get("ok"):
                plan = dict(plan)
                plan["heir"] = cand
                plan["reason"] = plan["reason"] + "+unique_head_skip"
                break
        else:
            return gate
    apply_succession(state, plan)
    set_dynasty_head(state, dynasty_id, plan["heir"])
    return {"ok": True, "plan": plan, "dynasty_id": dynasty_id}

