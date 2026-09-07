#!/usr/bin/env python3
"""Gens clock — 1 real day = 1 game month (CK-style succession progression).

Playable unit = gens (aliases: stirps / dynasty). populus = tribe gentes; Lusitani = confederation.
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
    if law == "elective":
        # Prefer dynasty/gens votes when dynasty_id known on bag; else gens/stirps eldest.
        did = (state.get("_elective_dynasty_id") or state.get("_elective_gens_id")
               or parent.get("player_dynasty_id") or parent.get("gens_id"))
        if did and (state.get("player_dynasties") or {}).get(did):
            resolved = resolve_elective(state, did)
            if resolved.get("ok") and resolved.get("heir"):
                rest = [m for m in (resolved.get("eligible") or []) if m != resolved["heir"]]
                return [resolved["heir"]] + rest
        # no votes yet → eligible gens/stirps members by age (eldest first) as ranking only
        stirps = parent.get("gens_id") or parent.get("stirps_id")
        members = [
            pid for pid, p in state["persons"].items()
            if (p.get("gens_id") or p.get("stirps_id")) == stirps and p.get("alive") and pid != parent_id
        ]
        members.sort(key=lambda k: (_age(state["persons"][k]), k), reverse=True)
        return members
    if law == "stirps_priority":
        stirps = parent.get("gens_id") or parent.get("stirps_id")
        members = [
            pid for pid, p in state["persons"].items()
            if (p.get("gens_id") or p.get("stirps_id")) == stirps and p.get("alive") and pid != parent_id
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
    dynasty_id: str | None = None,
    gens_id: str | None = None,
) -> dict[str, Any]:
    """PURE plan: who inherits holding when current holder is dead/abdicating."""
    law = law or succession_law(law_version, state)
    holding = state.get("holdings", {}).get(territory_id)
    if not holding:
        return {"ok": False, "error": "no_holding", "pure": True}
    holder = holding["holder_person_id"]
    did = gens_id or dynasty_id or holding.get("player_dynasty_id") or holding.get("gens_id")
    snap = state
    if law == "elective" and did:
        snap = dict(state)
        snap["_elective_dynasty_id"] = did
        snap["_elective_gens_id"] = did
    heirs = rank_heirs(snap, holder, law)
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
    inherited = inherit_political_edges(state, plan["from"], plan["heir"])
    return {"ok": True, "applied": plan, "inherited_edges": inherited}


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
    extinctions = []
    for did, d in list((kin_state.get("player_dynasties") or {}).items()):
        head = d.get("head_person_id")
        head_p = (kin_state.get("persons") or {}).get(head or "") or {}
        if head and not head_p.get("alive"):
            replaced = any(s.get("from") == head and s.get("ok") for s in successions)
            if not replaced:
                # try gens/dynasty succession under its own law (elective, children, etc.)
                cont = continue_gens_after_head_death(kin_state, did)
                if cont.get("ok"):
                    successions.append(cont.get("plan") or cont)
                    continue
                d["extinct"] = True
                d["head_person_id"] = None
                d["extinguished_game_month"] = kin_state["game_month"]
                extinctions.append({
                    "dynasty_id": did,
                    "gens_id": d.get("gens_id") or did,
                    "owner_subject_id": d.get("owner_subject_id"),
                    "last_head": head,
                    "outcome": "game_over",
                    "reason": "gens_extinction_no_valid_successor",
                })
            else:
                # holding succession replaced holder — sync gens head + inherit if needed
                for s in successions:
                    if s.get("from") == head and s.get("heir"):
                        set_dynasty_head(kin_state, did, s["heir"])
                        break
        elif d.get("extinct"):
            extinctions.append({
                "dynasty_id": did,
                "gens_id": d.get("gens_id") or did,
                "owner_subject_id": d.get("owner_subject_id"),
                "outcome": "game_over",
                "reason": "gens_already_extinct",
            })
    go = [e["dynasty_id"] for e in extinctions if e.get("outcome") == "game_over"]
    return {
        "ok": True,
        "months_advanced": months,
        "real_days_equivalent": months / max(real_day_to_game_months(), 1),
        "game_month": kin_state["game_month"],
        "deaths": deaths,
        "successions": successions,
        "extinctions": extinctions,
        "game_over_dynasties": go,
        "game_over_gentes": go,
        "law": law,
        "reason": "gens_tick_real_day_eq_game_month",
        "playable_unit": "gens",
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
    gens_id: str | None = None,
    populus_id: str | None = None,
    stirps_id: str | None = None,
    confederation: str = "lusitani",
) -> dict[str, Any]:
    """Register a player gens (legacy name: dynasty). owner_kind: acb|user (EN); SCA is PT label only."""
    if owner_kind not in ("acb", "user"):
        return {"ok": False, "error": "bad_owner_kind", "note": "use acb (EN) or user; SCA is PT for acb"}
    if not owner_subject_id or str(owner_subject_id).startswith("obj-"):
        return {"ok": False, "error": "owner_must_be_subject"}
    law = succession_law or succession_law_default()
    pd = state.setdefault("player_dynasties", {})
    gid = gens_id or dynasty_id
    pd[dynasty_id] = {
        "dynasty_id": dynasty_id,
        "gens_id": gid,
        "owner_subject_id": owner_subject_id,
        "owner_kind": owner_kind,  # acb | user
        "owner_label_pt": "SCA" if owner_kind == "acb" else "utilizador",
        "succession_law": law,
        "head_person_id": None,
        "succession_votes": {},
        "absentee": False,
        "steward_person_id": None,
        "absentee_since_game_month": None,
        "extinct": False,
        "playable_unit": "gens",
        "stirps_id": stirps_id,
        "populus_id": populus_id,
        "confederation": confederation,
    }
    return {"ok": True, "dynasty": pd[dynasty_id], "gens": pd[dynasty_id]}


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
    plan = resolve_succession(state, territory_id, law=law, dynasty_id=dynasty_id, gens_id=dynasty_id)
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
    applied = apply_succession(state, plan)
    set_dynasty_head(state, dynasty_id, plan["heir"])
    d = (state.get("player_dynasties") or {}).get(dynasty_id) or {}
    d["succession_votes"] = {}
    return {
        "ok": True,
        "plan": plan,
        "dynasty_id": dynasty_id,
        "gens_id": d.get("gens_id") or dynasty_id,
        "inherited_edges": applied.get("inherited_edges"),
    }




# ---------------------------------------------------------------------------
# Gens vocabulary aliases (player/API-facing)
# ---------------------------------------------------------------------------

ensure_player_gens = ensure_player_dynasty
set_gens_succession_law = set_dynasty_succession_law
set_gens_head = set_dynasty_head
gens_law = dynasty_law
assert_unique_gens_head = assert_unique_dynasty_head
apply_succession_to_gens = apply_succession_to_dynasty


def player_gentes(state: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Alias view of player_dynasties keyed as gentes."""
    return player_dynasties(state)


def eligible_gens_members(state: dict[str, Any], dynasty_id: str, *, exclude: str | None = None) -> list[str]:
    """Living persons of the gens/stirps tied to this player dynasty, or dynasty head's gens."""
    d = (state.get("player_dynasties") or {}).get(dynasty_id) or {}
    head = d.get("head_person_id")
    head_p = (state.get("persons") or {}).get(head or "") or {}
    gens_key = d.get("stirps_id") or head_p.get("gens_id") or head_p.get("stirps_id")
    out = []
    for pid, p in (state.get("persons") or {}).items():
        if not p.get("alive"):
            continue
        if exclude and pid == exclude:
            continue
        pk = p.get("gens_id") or p.get("stirps_id")
        if gens_key and pk == gens_key:
            out.append(pid)
        elif not gens_key and pid == head:
            out.append(pid)
    # also include explicitly listed eligible_person_ids on dynasty
    for pid in d.get("eligible_person_ids") or []:
        if pid not in out and (state.get("persons") or {}).get(pid, {}).get("alive"):
            if not exclude or pid != exclude:
                out.append(pid)
    out.sort(key=lambda k: (_age(state["persons"][k]), k), reverse=True)
    return out


def cast_succession_vote(
    state: dict[str, Any],
    dynasty_id: str,
    voter: str,
    nominee: str,
) -> dict[str, Any]:
    """Record elective vote: voter → nominee among living gens members."""
    pd = state.setdefault("player_dynasties", {})
    if dynasty_id not in pd:
        return {"ok": False, "error": "unknown_dynasty"}
    d = pd[dynasty_id]
    if dynasty_law(state, dynasty_id) != "elective" and d.get("succession_law") != "elective":
        # allow staging votes when switching to elective, but prefer law elective
        pass
    eligible = set(eligible_gens_members(state, dynasty_id))
    # head may vote even if listed
    head = d.get("head_person_id")
    if head and (state.get("persons") or {}).get(head, {}).get("alive"):
        eligible.add(head)
    if voter not in eligible:
        return {"ok": False, "error": "voter_not_eligible"}
    if nominee not in eligible or nominee == voter and len(eligible) == 1:
        # nominee must be living eligible (voter may nominate self if others exist or alone)
        if nominee not in eligible:
            return {"ok": False, "error": "nominee_not_eligible"}
    votes = dict(d.get("succession_votes") or {})
    votes[voter] = nominee
    d["succession_votes"] = votes
    return {
        "ok": True,
        "dynasty_id": dynasty_id,
        "gens_id": d.get("gens_id") or dynasty_id,
        "voter": voter,
        "nominee": nominee,
        "votes": dict(votes),
        "reason": "elective_vote_cast",
    }


def resolve_elective(state: dict[str, Any], dynasty_id: str) -> dict[str, Any]:
    """Plurality of succession_votes; tie → eldest among tied (by age_months, then id)."""
    d = (state.get("player_dynasties") or {}).get(dynasty_id) or {}
    if not d:
        return {"ok": False, "error": "unknown_dynasty", "pure": True}
    head = d.get("head_person_id")
    eligible = eligible_gens_members(state, dynasty_id, exclude=head if head and not (state.get("persons") or {}).get(head, {}).get("alive") else head)
    # On death, head is excluded as not alive via eligible_gens_members; if head still alive (preview), exclude head from heirs
    if head and head in eligible:
        eligible = [e for e in eligible if e != head]
    if not eligible:
        # fallback: any living eligible including without exclude
        eligible = eligible_gens_members(state, dynasty_id)
        eligible = [e for e in eligible if e != head]
    votes = d.get("succession_votes") or {}
    tally: dict[str, int] = {}
    for voter, nominee in votes.items():
        vp = (state.get("persons") or {}).get(voter) or {}
        if not vp.get("alive"):
            continue
        if nominee not in eligible:
            continue
        tally[nominee] = tally.get(nominee, 0) + 1
    if not tally:
        # no valid votes → eldest eligible
        if not eligible:
            return {"ok": False, "error": "no_heir", "pure": True, "law": "elective"}
        heir = eligible[0]  # already age-desc sorted
        return {
            "ok": True,
            "pure": True,
            "heir": heir,
            "law": "elective",
            "reason": "elective_no_votes_eldest_fallback",
            "eligible": eligible,
            "tally": {},
            "dynasty_id": dynasty_id,
            "gens_id": d.get("gens_id") or dynasty_id,
        }
    best = max(tally.values())
    tied = [pid for pid, n in tally.items() if n == best]
    tied.sort(key=lambda k: (_age(state["persons"][k]), k), reverse=True)
    heir = tied[0]
    reason = "elective_plurality" if len(tied) == 1 else "elective_tie_eldest"
    # full eligible ranking: winner then other tied by age then rest by votes/age
    rest = [e for e in eligible if e != heir]
    rest.sort(key=lambda k: (tally.get(k, 0), _age(state["persons"][k]), k), reverse=True)
    return {
        "ok": True,
        "pure": True,
        "heir": heir,
        "law": "elective",
        "reason": reason,
        "eligible": [heir] + rest,
        "tally": tally,
        "tied": tied if len(tied) > 1 else [],
        "dynasty_id": dynasty_id,
        "gens_id": d.get("gens_id") or dynasty_id,
    }


def resolve_gens_heir(state: dict[str, Any], dynasty_id: str) -> dict[str, Any]:
    """PURE — next gens head under that gens's law (no holding required)."""
    d = (state.get("player_dynasties") or {}).get(dynasty_id) or {}
    if not d:
        return {"ok": False, "error": "unknown_dynasty", "pure": True}
    if d.get("extinct"):
        return {"ok": False, "error": "gens_extinct", "pure": True}
    head = d.get("head_person_id")
    law = dynasty_law(state, dynasty_id)
    if law == "elective":
        return resolve_elective(state, dynasty_id)
    if not head:
        return {"ok": False, "error": "no_head", "pure": True}
    heirs = rank_heirs(state, head, law)
    if not heirs:
        heirs = rank_heirs(state, head, "stirps_priority")
        law = "stirps_priority"
    if not heirs:
        return {"ok": False, "error": "no_heir", "pure": True, "law": law}
    return {
        "ok": True,
        "pure": True,
        "heir": heirs[0],
        "from": head,
        "law": law,
        "reason": f"succession_law:{law}",
        "eligible": heirs,
        "dynasty_id": dynasty_id,
        "gens_id": d.get("gens_id") or dynasty_id,
    }


def continue_gens_after_head_death(state: dict[str, Any], dynasty_id: str) -> dict[str, Any]:
    """On head death: resolve heir, set head, inherit political edges; steward is not auto-heir."""
    plan = resolve_gens_heir(state, dynasty_id)
    if not plan.get("ok"):
        return plan
    heir = plan["heir"]
    gate = assert_unique_dynasty_head(state, heir, dynasty_id)
    if not gate.get("ok"):
        for cand in plan.get("eligible") or []:
            if cand == heir:
                continue
            if assert_unique_dynasty_head(state, cand, dynasty_id).get("ok"):
                plan = dict(plan)
                plan["heir"] = cand
                heir = cand
                plan["reason"] = str(plan.get("reason") or "") + "+unique_head_skip"
                break
        else:
            return gate
    d = state["player_dynasties"][dynasty_id]
    deceased = d.get("head_person_id")
    set_dynasty_head(state, dynasty_id, heir)
    inherited = inherit_political_edges(state, deceased, heir) if deceased else {"ok": True, "copied": []}
    d["succession_votes"] = {}
    # steward remains steward; not automatic heir
    return {
        "ok": True,
        "plan": {**plan, "from": deceased, "heir": heir},
        "from": deceased,
        "heir": heir,
        "dynasty_id": dynasty_id,
        "gens_id": d.get("gens_id") or dynasty_id,
        "inherited_edges": inherited,
        "reason": plan.get("reason") or "gens_succession",
    }


# ---------------------------------------------------------------------------
# Political edges (enemies / obligations) — first-class; oath_kin stays gens-level
# ---------------------------------------------------------------------------

POLITICAL_EDGE_KINDS = ("enemy_of", "owes_obligation_to", "owed_by")


def add_enemy(state: dict[str, Any], a: str, b: str, *, reason: str = "declared_enemy") -> dict[str, Any]:
    """a enemy_of b (and symmetric enemy_of for playability)."""
    if a == b:
        return {"ok": False, "error": "self_enemy"}
    edges = state.setdefault("edges", [])
    edges.append({"kind": "enemy_of", "a": a, "b": b, "reason": reason})
    edges.append({"kind": "enemy_of", "a": b, "b": a, "reason": reason})
    return {"ok": True, "kind": "enemy_of", "a": a, "b": b, "reason": reason}


def add_obligation(
    state: dict[str, Any],
    debtor: str,
    creditor: str,
    *,
    reason: str = "obligation",
    note: str | None = None,
) -> dict[str, Any]:
    """debtor owes_obligation_to creditor; creditor owed_by debtor."""
    if debtor == creditor:
        return {"ok": False, "error": "self_obligation"}
    edges = state.setdefault("edges", [])
    e1 = {"kind": "owes_obligation_to", "a": debtor, "b": creditor, "reason": reason}
    e2 = {"kind": "owed_by", "a": creditor, "b": debtor, "reason": reason}
    if note:
        e1["note"] = note
        e2["note"] = note
    edges.append(e1)
    edges.append(e2)
    return {"ok": True, "debtor": debtor, "creditor": creditor, "reason": reason}


def inherit_political_edges(state: dict[str, Any], from_person: str, to_person: str) -> dict[str, Any]:
    """Copy enemy_of / owes_obligation_to / owed_by from deceased to heir. oath_kin unchanged (gens-level)."""
    if not from_person or not to_person or from_person == to_person:
        return {"ok": True, "copied": [], "reason": "inheritance_noop"}
    edges = state.setdefault("edges", [])
    copied = []
    snapshot = list(edges)
    for e in snapshot:
        kind = e.get("kind")
        if kind not in POLITICAL_EDGE_KINDS:
            continue
        if e.get("a") == from_person:
            neo = dict(e)
            neo["a"] = to_person
            neo["inherited_from"] = from_person
            neo["reason"] = "inheritance"
            edges.append(neo)
            copied.append(neo)
        elif e.get("b") == from_person:
            neo = dict(e)
            neo["b"] = to_person
            neo["inherited_from"] = from_person
            neo["reason"] = "inheritance"
            edges.append(neo)
            copied.append(neo)
    return {"ok": True, "copied": copied, "count": len(copied), "reason": "inheritance", "from": from_person, "to": to_person}


# ---------------------------------------------------------------------------
# Absentee / steward delegation
# ---------------------------------------------------------------------------


def declare_absentee(state: dict[str, Any], dynasty_id: str, steward_person_id: str) -> dict[str, Any]:
    pd = state.get("player_dynasties") or {}
    if dynasty_id not in pd:
        return {"ok": False, "error": "unknown_dynasty"}
    d = pd[dynasty_id]
    if d.get("extinct"):
        return {"ok": False, "error": "gens_extinct"}
    steward = (state.get("persons") or {}).get(steward_person_id) or {}
    if not steward.get("alive"):
        return {"ok": False, "error": "steward_not_alive"}
    if steward_person_id == d.get("head_person_id"):
        return {"ok": False, "error": "steward_is_head"}
    d["absentee"] = True
    d["steward_person_id"] = steward_person_id
    d["absentee_since_game_month"] = int(state.get("game_month") or 0)
    return {
        "ok": True,
        "dynasty_id": dynasty_id,
        "gens_id": d.get("gens_id") or dynasty_id,
        "steward_person_id": steward_person_id,
        "absentee_since_game_month": d["absentee_since_game_month"],
        "reason": "declare_absentee",
        "note": "steward_may_tick_eligibility; steward_not_auto_heir",
    }


def return_from_absentee(state: dict[str, Any], dynasty_id: str) -> dict[str, Any]:
    pd = state.get("player_dynasties") or {}
    if dynasty_id not in pd:
        return {"ok": False, "error": "unknown_dynasty"}
    d = pd[dynasty_id]
    d["absentee"] = False
    d["steward_person_id"] = None
    d["absentee_since_game_month"] = None
    return {"ok": True, "dynasty_id": dynasty_id, "gens_id": d.get("gens_id") or dynasty_id, "reason": "return_from_absentee"}


def steward_may_act(state: dict[str, Any], dynasty_id: str, actor_person_id: str | None = None) -> dict[str, Any]:
    """While absentee, steward can run advance_game_month tick eligibility for this gens.
    Head still ages; on head death succession still runs (steward is not automatic heir).
    """
    d = (state.get("player_dynasties") or {}).get(dynasty_id) or {}
    if not d:
        return {"ok": False, "may_act": False, "error": "unknown_dynasty"}
    if d.get("extinct"):
        return {"ok": False, "may_act": False, "error": "gens_extinct"}
    head = d.get("head_person_id")
    if not d.get("absentee"):
        may = actor_person_id is None or actor_person_id == head
        return {"ok": True, "may_act": may, "absentee": False, "role": "head" if may else "none"}
    steward = d.get("steward_person_id")
    sp = (state.get("persons") or {}).get(steward or "") or {}
    if not steward or not sp.get("alive"):
        return {"ok": False, "may_act": False, "error": "steward_unavailable", "absentee": True}
    if actor_person_id is None or actor_person_id == steward:
        return {
            "ok": True,
            "may_act": True,
            "absentee": True,
            "steward_person_id": steward,
            "role": "steward",
            "note": "steward_keeps_tick_eligibility_not_invent_heirs",
        }
    if actor_person_id == head:
        return {"ok": True, "may_act": True, "absentee": True, "role": "head_still_may"}
    return {"ok": True, "may_act": False, "absentee": True, "role": "none"}
