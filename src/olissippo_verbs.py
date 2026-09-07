#!/usr/bin/env python3
"""Olissippo Phase 8A/8B — finite verb registry, validate, execute (event-producing)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import olissippo_castro as castro
import olissippo_claims as claims
import olissippo_council as council
import olissippo_events as ev
import olissippo_grove_lex as lex
import olissippo_kin as kin
import olissippo_lots as lots

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "contracts" / "mud" / "olissippo-verb-registry.json"
POLICY_PATH = ROOT / "contracts" / "mud" / "olissippo-policy-layer.json"


@lru_cache(maxsize=1)
def load_registry() -> dict[str, Any]:
    data = json.loads(PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    return data


@lru_cache(maxsize=1)
def load_policy() -> dict[str, Any]:
    return json.loads(POLICY_PATH.read_text())


def verb_index() -> dict[str, dict[str, Any]]:
    return {v["id"]: v for v in load_registry()["verbs"]}


def canonical_verb(verb: str) -> str:
    idx = verb_index()
    if verb not in idx:
        return verb
    return idx[verb].get("canonical") or verb


def validate_verb(verb: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Validate finite verb + reject Subject self-object_id/mint."""
    payload = payload or {}
    idx = verb_index()
    if verb not in idx:
        return {"ok": False, "error": "unknown_verb", "verb": verb}
    for bad in ("object_id", "mint_nft", "become_nft"):
        if bad in payload and payload.get("_allow_object_fields") is not True:
            # subject actions must not claim NFT identity
            if bad == "object_id" and payload.get("kind") == "subject_self":
                return {"ok": False, "error": "acb_is_not_nft", "verb": verb}
            if bad in ("mint_nft", "become_nft"):
                return {"ok": False, "error": "acb_is_not_nft", "verb": verb}
            if bad == "object_id" and payload.get("subject_claims_self_object"):
                return {"ok": False, "error": "acb_is_not_nft", "verb": verb}
    if payload.get("subject_self_object_id") or payload.get("mint_as_subject"):
        return {"ok": False, "error": "acb_is_not_nft", "verb": verb}
    canon = canonical_verb(verb)
    return {
        "ok": True,
        "verb": verb,
        "canonical": canon,
        "engines": list(idx[verb].get("engines") or []),
        "rule_version": load_registry().get("rule_version"),
    }


def _law_version(bag: dict[str, Any]) -> str:
    return str(bag.get("law_version") or load_policy()["policy"]["law_version"])


def _emit(
    bag: dict[str, Any],
    *,
    event_type: str,
    verb: str,
    reason: str,
    actors: list[str] | None = None,
    object_ids: list[str] | None = None,
    location_ids: list[str] | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    causes: list[str] | None = None,
    season: int | None = None,
) -> dict[str, Any]:
    evt = ev.make_event(
        event_type=event_type,
        verb=verb,
        reason=reason,
        law_version=_law_version(bag),
        actor_subject_ids=actors,
        object_ids=object_ids,
        location_ids=location_ids,
        before=before,
        after=after,
        causes=causes,
        season=season if season is not None else bag.get("season"),
        rule_version=load_registry().get("rule_version"),
    )
    ev.append_event(bag, evt)
    return evt


def execute_verb(
    bag: dict[str, Any],
    verb: str,
    payload: dict[str, Any] | None = None,
    *,
    actor_subject_id: str | None = None,
) -> dict[str, Any]:
    """Execute finite verb against council bag; return {ok, events, reason, ...}."""
    payload = dict(payload or {})
    gate = validate_verb(verb, payload)
    if not gate.get("ok"):
        return {"ok": False, "events": [], "reason": gate.get("error", "invalid"), "error": gate.get("error"), "detail": gate}

    # reject subject self-as-object even if sneaked via nested keys
    if payload.get("object_id") and payload.get("kind") == "acb":
        return {"ok": False, "events": [], "reason": "acb_is_not_nft", "error": "acb_is_not_nft"}

    canon = gate["canonical"]
    actor = actor_subject_id or payload.get("actor_subject_id") or payload.get("subject_id")
    actors = [actor] if actor else []
    emitted: list[dict[str, Any]] = []

    def done(ok: bool, reason: str, result: dict[str, Any], evt: dict[str, Any] | None = None) -> dict[str, Any]:
        evts = list(emitted)
        if evt:
            evts.append(evt)
        return {
            "ok": ok,
            "events": evts,
            "reason": reason,
            "verb": verb,
            "canonical": canon,
            "result": result,
            "law_version": _law_version(bag),
        }

    # --- adjudication season bag ---
    if canon == "submit_order":
        r = council.submit_order(bag, payload.get("order") or payload)
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="order_submitted",
                verb=canon,
                reason="order_queued_for_season",
                actors=actors,
                before={},
                after={"order": r.get("order")},
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "order_queued", r, None if r.get("ok") else None)

    if canon == "close_season":
        r = council.close_season(bag)
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="season_closed",
                verb=canon,
                reason="season_closed_for_resolve",
                actors=actors,
                after={"season": bag.get("season"), "order_count": len(bag.get("orders") or [])},
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "season_closed", r)

    if canon in ("bandua_resolve_season", "resolve_season") or verb == "bandua_resolve_season":
        orders = payload.get("orders")
        if orders is None:
            orders = list(bag.get("orders") or [])
        resolution = council.resolve_season(orders)
        if not resolution.get("ok"):
            return done(False, resolution.get("error") or "resolve_failed", resolution)
        applied = council.apply_resolution(bag, resolution)
        evt = _emit(
            bag,
            event_type="season_resolved",
            verb="bandua_resolve_season",
            reason="pure_resolve_then_apply",
            actors=actors,
            before={"orders": orders},
            after={"positions": resolution.get("positions"), "moved": resolution.get("moved")},
            season=bag.get("season"),
        )
        emitted.append(evt)
        return done(True, "season_resolved", {"resolution": resolution, "applied": applied})

    # --- law ---
    if canon == "propose_law":
        r = lex.propose_lex(
            bag.setdefault("grove", lex.new_state()),
            actor or "unknown",
            str(payload.get("text") or ""),
            target_id=payload.get("target_id"),
            replace=bool(payload.get("replace")),
        )
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="law_proposed",
                verb=canon,
                reason="grove_proposal_open",
                actors=actors,
                after={"proposal_id": r.get("proposal_id")},
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "proposed", r)

    if canon == "vote_law":
        r = lex.vote_lex(
            bag.setdefault("grove", lex.new_state()),
            str(payload["proposal_id"]),
            (actor or "voter")[-12:],
            bool(payload.get("aye", True)),
        )
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="law_voted",
                verb=canon,
                reason="vote_recorded",
                actors=actors,
                after=r,
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "voted", r)

    if canon == "enact_law":
        r = lex.enact_lex(bag.setdefault("grove", lex.new_state()), str(payload["proposal_id"]))
        if r.get("ok"):
            # bump law_version
            cur = _law_version(bag)
            base, _, num = cur.partition("-")
            try:
                n = int(num) + 1
            except ValueError:
                n = 2
            bag["law_version"] = f"{base or 'hearthlaw'}-{n}"
            evt = _emit(
                bag,
                event_type="law_enacted",
                verb=canon,
                reason="policy_enacted_law_version_bumped",
                actors=actors,
                after={**r, "law_version": bag["law_version"]},
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "enacted", r)

    # --- kinship / claims ---
    if canon == "marry":
        r = kin.marry(bag.setdefault("kin", kin.new_state()), payload["a"], payload["b"])
        if r.get("ok"):
            evt = _emit(bag, event_type="kinship", verb=canon, reason="marriage_alliance", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "married", r)

    if canon == "acknowledge_heir":
        r = kin.acknowledge_heir(bag.setdefault("kin", kin.new_state()), payload["parent_id"], payload["child_id"])
        if r.get("ok"):
            evt = _emit(bag, event_type="kinship", verb=canon, reason="heir_acknowledged", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "heir_ok", r)

    if canon == "foster":
        r = kin.foster(bag.setdefault("kin", kin.new_state()), payload["child_id"], payload["host_person_id"])
        if r.get("ok"):
            evt = _emit(bag, event_type="kinship", verb=canon, reason="foster_guest_right", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "fostered", r)

    if canon == "press_claim":
        r = claims.press_claim(
            bag.setdefault("claims", claims.new_state()),
            str(payload["stirps_id"]),
            str(payload["territory_id"]),
            str(payload.get("kind") or "raid_trophy"),
            str(payload.get("holder_person_id") or "kin-oli-chefe-heir"),
        )
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="claim_pressed",
                verb=canon,
                reason="claim_record_created_having_ne_pressing",
                actors=actors,
                location_ids=[str(payload["territory_id"])],
                after=r,
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "claim_pressed", r)

    if canon == "succeed_holding":
        r = kin.succeed_holding(bag.setdefault("kin", kin.new_state()), str(payload["territory_id"]))
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="succession",
                verb=canon,
                reason=f"succession_policy:{load_policy()['policy']['succession_policy']['resolve']}",
                actors=actors,
                location_ids=[str(payload["territory_id"])],
                after=r,
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "succeeded", r)

    # --- settlement ---
    cst = bag.setdefault("castro", castro.new_state())

    if canon == "tick_production":
        cid = payload.get("castro_id")
        before_res = {}
        if cid and cid in cst["castros"]:
            before_res = dict(cst["castros"][cid].get("resources") or {})
        r = castro.tick_production(cst, cid)
        if r.get("ok"):
            # sync lots from resources (production mints lots)
            targets = [cid] if cid else list(cst["castros"])
            for t in targets:
                c = cst["castros"][t]
                lots.sync_lots_from_resources(c)
            obj_ids = []
            if cid and cid in cst["castros"]:
                c = cst["castros"][cid]
                obj_ids = [c.get("object_id")] + list((c.get("lot_object_ids") or {}).values())
            evt = _emit(
                bag,
                event_type="production_tick",
                verb=canon,
                reason="production_mints_strata_lots",
                actors=actors,
                object_ids=[x for x in obj_ids if x],
                before={"resources": before_res},
                after=r.get("results"),
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "production_ticked", r)

    if canon == "upgrade_work":
        r = castro.upgrade_work(cst, payload["castro_id"], payload["work_id"])
        if r.get("ok"):
            c = cst["castros"][payload["castro_id"]]
            lots.sync_lots_from_resources(c)
            evt = _emit(
                bag,
                event_type="work_upgraded",
                verb=canon,
                reason="work_level_increased",
                actors=actors,
                object_ids=[c.get("object_id")],
                after=r,
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "upgraded", r)

    if canon == "plant_castro":
        r = castro.plant_castro(
            cst,
            payload["castro_id"],
            payload["territory_id"],
            payload.get("new_castro_id"),
        )
        if r.get("ok"):
            neo = r["castro"]
            lots.ensure_castro_lots(neo)
            evt = _emit(
                bag,
                event_type="castro_planted",
                verb=canon,
                reason="daughter_castro_strata_nft_minted",
                actors=actors,
                object_ids=[neo.get("object_id")],
                location_ids=[payload["territory_id"]],
                after={"castro_id": neo["castro_id"], "object_id": neo.get("object_id")},
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "planted", r)

    if canon == "cattle_raid":
        r = castro.cattle_raid(
            cst,
            payload["castro_id"],
            payload["target_castro_id"],
            int(payload["band_size"]),
        )
        if r.get("ok"):
            for x in (payload["castro_id"], payload["target_castro_id"]):
                if x in cst["castros"]:
                    lots.sync_lots_from_resources(cst["castros"][x])
            evt = _emit(
                bag,
                event_type="raid",
                verb=canon,
                reason="cattle_raid_not_siege_not_annex",
                actors=actors,
                object_ids=[
                    cst["castros"].get(payload["castro_id"], {}).get("object_id"),
                    cst["castros"].get(payload["target_castro_id"], {}).get("object_id"),
                ],
                after=r,
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "raid_done", r)

    if canon == "siege_enclosure":
        r = castro.siege_enclosure(
            cst,
            payload["castro_id"],
            payload["target_castro_id"],
            int(payload["band_size"]),
        )
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="siege",
                verb=canon,
                reason="siege_not_raid_not_annex",
                actors=actors,
                after=r,
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "siege_done", r)

    if canon == "reinforce":
        r = castro.reinforce(cst, payload["castro_id"], int(payload.get("grain") or 10))
        if r.get("ok"):
            lots.sync_lots_from_resources(cst["castros"][payload["castro_id"]])
            evt = _emit(bag, event_type="reinforce", verb=canon, reason="population_reinforced", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "reinforced", r)

    # --- market ---
    if canon == "exchange":
        r = castro.quay_barter(
            cst,
            payload["castro_id"],
            str(payload["give"]),
            str(payload["want"]),
            int(payload["amount"]),
        )
        if r.get("ok"):
            c = cst["castros"][payload["castro_id"]]
            lots.sync_lots_from_resources(c)
            evt = _emit(
                bag,
                event_type="exchange",
                verb=canon,
                reason="quay_barter_lore_instance_of_exchange",
                actors=actors,
                object_ids=[c.get("object_id")] + list((c.get("lot_object_ids") or {}).values()),
                location_ids=["quay", "market"],
                after=r,
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "exchanged", r)

    if canon == "craft_tick":
        r = castro.craft_tick(cst, payload.get("castro_id"))
        if r.get("ok"):
            evt = _emit(bag, event_type="craft_tick", verb=canon, reason="craft_points_accrued", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "craft_ticked", r)

    if canon == "unlock_craft":
        r = castro.unlock_craft(cst, payload["castro_id"])
        if r.get("ok"):
            evt = _emit(bag, event_type="craft_unlock", verb=canon, reason="craft_tier_advanced", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "craft_unlocked", r)

    return done(False, "unhandled_verb", {"error": "unhandled_verb", "verb": verb, "canonical": canon})
