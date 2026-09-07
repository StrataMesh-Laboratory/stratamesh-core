#!/usr/bin/env python3
"""Phase 8A/8B — council runtime bag: events[], law_version, lots; dispatch via verbs.

Lore skin, same STRATA stakes. Castros and lots are STRATA NFTs (object_id).
Subjects hold title; ACB ≠ NFT.
Pipeline: intent→finite verb→validate→plan→adjudicate→transition→Event.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import olissippo_castro as castro
import olissippo_claims as claims
import olissippo_grove_lex as lex
import olissippo_kin as kin
import olissippo_lots as lots
import olissippo_verbs as verbs

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "contracts" / "mud" / "olissippo-policy-layer.json"

# Decide-facing action types (aliases included) — keep Phase 8 wire green
COUNCIL_VERBS = frozenset({
    "castro_tick_production",
    "castro_upgrade_work",
    "castro_quay_barter",
    "castro_cattle_raid",
    "castro_plant",
    "castro_siege",
    "castro_craft_tick",
    "castro_unlock_craft",
    "castro_reinforce",
    "grove_propose",
    "grove_vote",
    "grove_enact",
    "claim_press",
    "press_claim",
    "bandua_resolve_season",
    "submit_order",
    "close_season",
    "tick_production",
    "upgrade_work",
    "exchange",
    "quay_barter",
    "plant_castro",
    "cattle_raid",
    "siege_enclosure",
    "reinforce",
    "craft_tick",
    "unlock_craft",
    "propose_law",
    "vote_law",
    "enact_law",
    "marry",
    "acknowledge_heir",
    "foster",
    "succeed_holding",
})


def _default_law_version() -> str:
    try:
        return json.loads(POLICY_PATH.read_text())["policy"]["law_version"]
    except Exception:
        return "hearthlaw-1"


def _stamp_castro(c: dict[str, Any]) -> None:
    cid = c["castro_id"]
    c.setdefault("object_id", f"obj-oli-{cid}")
    c.setdefault("is_nft", True)
    c.setdefault("nft_family", "STRATA")
    c.setdefault(
        "lot_object_ids",
        {r: f"obj-oli-lot-{cid}-{r}" for r in ("herd", "grain", "timber", "ore")},
    )
    lots.ensure_castro_lots(c)


def ensure_bag(state: dict[str, Any]) -> dict[str, Any]:
    """Idempotent council bag — events, law_version, lots, STRATA stamps."""
    bag = state.get("council")
    if bag and isinstance(bag, dict) and "castro" in bag:
        bag.setdefault("events", [])
        bag.setdefault("law_version", _default_law_version())
        bag.setdefault("lots", {})
        bag.setdefault("bandua", {"season": 0, "orders": [], "closed": False})
        bag.setdefault("season", bag.get("bandua", {}).get("season", 0))
        bag.setdefault("lore_economics_equivalent_to_main", True)
        for c in bag["castro"]["castros"].values():
            _stamp_castro(c)
        return bag

    bag = {
        "castro": castro.new_state(),
        "claims": claims.new_state(),
        "grove": lex.new_state(),
        "kin": kin.new_state(),
        "bandua": {"season": 0, "orders": [], "closed": False},
        "bandua_last": None,
        "events": [],
        "law_version": _default_law_version(),
        "lots": {},
        "season": 0,
        "lore_economics_equivalent_to_main": True,
    }
    for c in bag["castro"]["castros"].values():
        _stamp_castro(c)
        # register lots in bag.lots store
        for r, lot in (c.get("lots") or {}).items():
            bag["lots"][lot["object_id"]] = lot
    state["council"] = bag
    return bag


def castro_for_subject(state: dict[str, Any]) -> str | None:
    """Home castro whose holder_subject matches this ACB."""
    bag = ensure_bag(state)
    sid = state.get("subject_id")
    for c in bag["castro"]["castros"].values():
        if c.get("holder_subject") == sid:
            return c["castro_id"]
    if sid in ("acb-boutius-001", "acb-oli-boutius-001"):
        return "castro-olissippo"
    return None


def perception_council(state: dict[str, Any]) -> dict[str, Any]:
    bag = ensure_bag(state)
    home = castro_for_subject(state)
    home_c = bag["castro"]["castros"].get(home) if home else None
    return {
        "home_castro_id": home,
        "home_object_id": (home_c or {}).get("object_id"),
        "home_resources": dict((home_c or {}).get("resources") or {}),
        "home_works": dict((home_c or {}).get("works") or {}),
        "lot_object_ids": dict((home_c or {}).get("lot_object_ids") or {}),
        "is_strata_nft": True,
        "lore_economics_equivalent_to_main": True,
        "castro_count": len(bag["castro"]["castros"]),
        "claims_count": len(bag["claims"]["claims"]),
        "law_version": bag.get("law_version"),
        "event_count": len(bag.get("events") or []),
        "season": bag.get("season"),
    }


def validate_council_action(state: dict[str, Any], act: dict[str, Any]) -> dict[str, Any]:
    typ = str(act.get("type") or "")
    if typ not in COUNCIL_VERBS:
        return {"ok": False, "error": "not_council_verb"}
    if "object_id" in act or "mint_nft" in act or "become_nft" in act:
        return {"ok": False, "error": "acb_is_not_nft", "action": act}
    ensure_bag(state)
    home = castro_for_subject(state)

    # Map decide action types → verb payload
    if typ in ("castro_tick_production", "tick_production"):
        cid = act.get("castro_id") or home
        if not cid:
            return {"ok": False, "error": "no_castro"}
        return {"ok": True, "action": {"type": typ, "verb": "tick_production", "castro_id": cid}}

    if typ in ("castro_upgrade_work", "upgrade_work"):
        cid = act.get("castro_id") or home
        work = act.get("work_id") or act.get("work")
        if not cid or not work:
            return {"ok": False, "error": "missing_work"}
        return {"ok": True, "action": {"type": typ, "verb": "upgrade_work", "castro_id": cid, "work_id": str(work)}}

    if typ in ("castro_quay_barter", "exchange", "quay_barter"):
        if state.get("location_id") not in ("market", "quay"):
            return {"ok": False, "error": "not_at_quay_or_market"}
        cid = act.get("castro_id") or home
        give, want = act.get("give"), act.get("want")
        amount = int(act.get("amount") or 0)
        if not cid or not give or not want or amount < 1:
            return {"ok": False, "error": "bad_barter"}
        return {
            "ok": True,
            "action": {
                "type": typ,
                "verb": "exchange",
                "castro_id": cid,
                "give": str(give),
                "want": str(want),
                "amount": amount,
            },
        }

    if typ in ("castro_cattle_raid", "cattle_raid", "castro_siege", "siege_enclosure"):
        cid = act.get("castro_id") or home
        target = act.get("target_castro_id") or act.get("defender_id")
        band = int(act.get("band_size") or 0)
        if not cid or not target or band < 1:
            return {"ok": False, "error": "bad_raid_or_siege"}
        verb = "siege_enclosure" if typ in ("castro_siege", "siege_enclosure") else "cattle_raid"
        return {
            "ok": True,
            "action": {
                "type": typ,
                "verb": verb,
                "castro_id": cid,
                "target_castro_id": str(target),
                "band_size": band,
            },
        }

    if typ in ("castro_plant", "plant_castro"):
        cid = act.get("castro_id") or home
        terr = act.get("territory_id")
        if not cid or not terr:
            return {"ok": False, "error": "missing_plant_target"}
        return {
            "ok": True,
            "action": {
                "type": typ,
                "verb": "plant_castro",
                "castro_id": cid,
                "territory_id": str(terr),
                "new_castro_id": act.get("new_castro_id"),
            },
        }

    if typ in ("castro_craft_tick", "craft_tick", "castro_unlock_craft", "unlock_craft", "castro_reinforce", "reinforce"):
        cid = act.get("castro_id") or home
        if not cid:
            return {"ok": False, "error": "no_castro"}
        verb_map = {
            "castro_craft_tick": "craft_tick",
            "craft_tick": "craft_tick",
            "castro_unlock_craft": "unlock_craft",
            "unlock_craft": "unlock_craft",
            "castro_reinforce": "reinforce",
            "reinforce": "reinforce",
        }
        out: dict[str, Any] = {"type": typ, "verb": verb_map[typ], "castro_id": cid}
        if verb_map[typ] == "reinforce":
            out["grain"] = int(act.get("grain") or 10)
        return {"ok": True, "action": out}

    if typ in ("grove_propose", "propose_law"):
        text = str(act.get("text") or "").strip()
        if len(text) < 3:
            return {"ok": False, "error": "empty_proposal"}
        return {
            "ok": True,
            "action": {
                "type": typ,
                "verb": "propose_law",
                "text": text,
                "target_id": act.get("target_id"),
                "replace": bool(act.get("replace")),
            },
        }

    if typ in ("grove_vote", "vote_law"):
        pid = act.get("proposal_id")
        if not pid:
            return {"ok": False, "error": "missing_proposal"}
        return {
            "ok": True,
            "action": {
                "type": typ,
                "verb": "vote_law",
                "proposal_id": str(pid),
                "aye": bool(act.get("aye", True)),
            },
        }

    if typ in ("grove_enact", "enact_law"):
        pid = act.get("proposal_id")
        if not pid:
            return {"ok": False, "error": "missing_proposal"}
        return {"ok": True, "action": {"type": typ, "verb": "enact_law", "proposal_id": str(pid)}}

    if typ in ("claim_press", "press_claim"):
        stirps = act.get("stirps_id")
        terr = act.get("territory_id")
        kind = act.get("kind") or "raid_trophy"
        holder = act.get("holder_person_id") or "kin-oli-chefe-heir"
        if not stirps or not terr:
            return {"ok": False, "error": "missing_claim_fields"}
        return {
            "ok": True,
            "action": {
                "type": typ,
                "verb": "press_claim",
                "stirps_id": str(stirps),
                "territory_id": str(terr),
                "kind": str(kind),
                "holder_person_id": str(holder),
            },
        }

    if typ == "bandua_resolve_season":
        orders = act.get("orders")
        if not isinstance(orders, list) or not orders:
            return {"ok": False, "error": "missing_orders"}
        return {"ok": True, "action": {"type": typ, "verb": "bandua_resolve_season", "orders": orders}}

    if typ == "submit_order":
        order = act.get("order") or {k: act[k] for k in act if k not in ("type", "verb")}
        return {"ok": True, "action": {"type": typ, "verb": "submit_order", "order": order}}

    if typ == "close_season":
        return {"ok": True, "action": {"type": typ, "verb": "close_season"}}

    if typ in ("marry", "acknowledge_heir", "foster", "succeed_holding"):
        out = {"type": typ, "verb": typ}
        out.update({k: act[k] for k in act if k != "type"})
        return {"ok": True, "action": out}

    return {"ok": False, "error": "unhandled_council", "action": act}


def execute_council_action(state: dict[str, Any], validated: dict[str, Any]) -> dict[str, Any]:
    """Mutate council bag via verb engine; emit Events."""
    s = state
    bag = ensure_bag(s)
    act = validated["action"]
    typ = act["type"]
    verb = act.get("verb") or typ
    payload = {k: v for k, v in act.items() if k not in ("type",)}
    out = verbs.execute_verb(
        bag,
        verb,
        payload,
        actor_subject_id=s.get("subject_id"),
    )
    s["council"] = bag
    return {
        "ok": bool(out.get("ok")),
        "type": typ,
        "verb": verb,
        "canonical": out.get("canonical"),
        "result": out.get("result"),
        "events": out.get("events") or [],
        "reason": out.get("reason"),
        "law_version": out.get("law_version") or bag.get("law_version"),
        "source": "council_runtime",
        "strata_stakes": True,
    }
