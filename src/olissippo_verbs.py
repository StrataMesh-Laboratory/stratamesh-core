#!/usr/bin/env python3
"""Olissippo Phase 8A–8D — finite verb registry, validate, execute (event-producing).

Phase 8C: execute paths for season/law/succession/production/trade/dynasty go through
pure adjudicators (resolve/plan) then apply_* mutators.
Phase 8D: apply paths emit Events with provenance depth for LLM explain_event.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import olissippo_adjudicators as adj
import olissippo_castro as castro
import olissippo_claims as claims
import olissippo_council as council
import olissippo_events as ev
import olissippo_grove_lex as lex
import olissippo_kin as kin
import olissippo_dynasty_clock as dynasty_clock
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
    game_month: int | None = None,
    provenance: dict[str, Any] | list | None = None,
) -> dict[str, Any]:
    clk = bag.get("clock") or (bag.get("kin") or {}).get("clock") or {}
    gm = game_month if game_month is not None else clk.get("game_month")
    if gm is None:
        gm = (bag.get("kin") or {}).get("game_month")
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
        game_month=None if gm is None else int(gm),
        rule_version=load_registry().get("rule_version"),
        provenance=provenance,
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
        target = bag["bandua"] if isinstance(bag.get("bandua"), dict) else bag
        r = adj.SeasonAdjudicator.close_season(target)
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="season_closed",
                verb=canon,
                reason="season_closed_for_resolve",
                actors=actors,
                after={"season": target.get("season"), "order_count": len(target.get("orders") or [])},
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "season_closed", r)

    if canon in ("bandua_resolve_season", "resolve_season") or verb == "bandua_resolve_season":
        orders = payload.get("orders")
        if orders is None:
            src = bag.get("bandua") if isinstance(bag.get("bandua"), dict) else bag
            orders = list(src.get("orders") or bag.get("orders") or [])
        resolution = adj.SeasonAdjudicator.resolve_season(bag, orders)
        if not resolution.get("ok"):
            return done(False, resolution.get("error") or "resolve_failed", resolution)
        applied = adj.SeasonAdjudicator.apply_resolution(bag, resolution)
        if not applied.get("ok"):
            return done(False, applied.get("error") or "apply_failed", applied)
        evt = applied.get("event")
        if evt:
            # annotate actors on apply event (adjudicator emit may lack actor list)
            if actors and not evt.get("actor_subject_ids"):
                evt["actor_subject_ids"] = list(actors)
            emitted.append(evt)
        return done(True, "season_resolved", {"resolution": resolution, "applied": applied})

    # --- law ---
    if canon == "propose_law":
        changes = payload.get("changes")
        if changes:
            r = adj.LawAdjudicator.propose_policy_change(
                bag,
                actor or "unknown",
                list(changes),
                prose_text=str(payload.get("text") or payload.get("prose_text") or ""),
            )
        else:
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
                after={"proposal_id": r.get("proposal_id"), "changes": changes},
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
        pid = str(payload["proposal_id"])
        grove = bag.setdefault("grove", lex.new_state())
        prop = (grove.get("proposals") or {}).get(pid) or {}
        votes = payload.get("votes")
        if prop.get("changes") or payload.get("typed_policy"):
            plan = adj.LawAdjudicator.resolve_enact(bag, pid, votes=votes)
            if not plan.get("ok"):
                return done(False, plan.get("error") or "enact_failed", plan)
            r = adj.LawAdjudicator.apply_enact(bag, plan)
            if r.get("event"):
                emitted.append(r["event"])
            return done(bool(r.get("ok")), r.get("error") or "enacted", {"plan": plan, "applied": r})
        # legacy grove prose enact
        r = lex.enact_lex(grove, pid)
        if r.get("ok"):
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
        kind = str(payload.get("kind") or "raid_trophy")
        holder = str(payload.get("holder_person_id") or actor or "kin-oli-chefe-heir")
        gate = adj.ClaimStrength.validate_press(
            kind,
            subject=holder,
            policy=adj.policy_snapshot(bag),
            edges=list((bag.get("kin") or {}).get("edges") or []),
        )
        if not gate.get("ok"):
            return done(False, gate.get("error") or "below_claim_threshold", gate)
        r = claims.press_claim(
            bag.setdefault("claims", claims.new_state()),
            str(payload["stirps_id"]),
            str(payload["territory_id"]),
            kind,
            holder,
        )
        if r.get("ok"):
            r["strength"] = gate["strength"]
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
        kin_state = bag.setdefault("kin", kin.new_state())
        tid = str(payload["territory_id"])
        holding = dict(kin_state.get("holdings", {}).get(tid) or {})
        holding["territory_id"] = tid
        deceased = str(payload.get("deceased") or holding.get("holder_person_id") or "")
        plan = adj.succession_policy.resolve(
            holding,
            deceased,
            _law_version(bag),
            kin_state,
            policy=adj.policy_snapshot(bag),
        )
        plan["territory_id"] = tid
        if not plan.get("ok"):
            return done(False, plan.get("error") or "no_heir", plan)
        r = adj.SuccessionResolver.apply_succession(bag, plan)
        if r.get("event"):
            emitted.append(r["event"])
        return done(bool(r.get("ok")), r.get("error") or "succeeded", {"plan": plan, "applied": r})

    if canon == "advance_game_month":
        months = int(payload.get("months") or 1)
        kin_state = bag.setdefault("kin", kin.new_state())
        clock = bag.get("clock") or kin_state.get("clock") or adj.DynastyClock.default_clock()
        plan = adj.DynastyClock.plan_advance(
            kin_state,
            clock,
            _law_version(bag),
            months=months,
            policy=adj.policy_snapshot(bag),
        )
        if not plan.get("ok"):
            return done(False, plan.get("error") or "advance_failed", plan)
        r = adj.DynastyClock.apply_advance(bag, plan)
        if r.get("event"):
            emitted.append(r["event"])
        for s in r.get("successions") or []:
            if s.get("event"):
                emitted.append(s["event"])
        return done(bool(r.get("ok")), r.get("error") or "dynasty_ticked", {"plan": plan, "applied": r})

    # --- settlement ---
    cst = bag.setdefault("castro", castro.new_state())

    if canon == "tick_production":
        cid = payload.get("castro_id")
        targets = [cid] if cid else list(cst["castros"])
        results = {}
        ok_any = False
        for t_id in targets:
            c = cst["castros"].get(t_id)
            if not c:
                return done(False, "unknown_castro", {"castro_id": t_id})
            plan = adj.ProductionResolver.production_tick(
                c,
                works=c.get("works"),
                lots_view=c.get("lots"),
                law_version=_law_version(bag),
                elapsed=int(payload.get("elapsed") or 1),
            )
            applied = adj.ProductionResolver.apply_production(bag, t_id, plan)
            if applied.get("event"):
                emitted.append(applied["event"])
            results[t_id] = {"plan": plan, "applied": applied}
            ok_any = ok_any or bool(applied.get("ok"))
        return done(ok_any, "production_ticked" if ok_any else "production_failed", {"results": results})

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
        plan = adj.TradeResolver.exchange(
            offer={
                "castro_id": payload["castro_id"],
                "resource": str(payload.get("give") or payload.get("resource")),
                "qty": int(payload.get("amount") or payload.get("qty") or 0),
            },
            demand={"resource": str(payload.get("want") or payload.get("demand"))},
            counterparty=payload.get("counterparty"),
            venue=str(payload.get("venue") or "quay"),
            constraints=payload.get("constraints"),
            bag_view={"castro": cst},
        )
        if not plan.get("ok"):
            return done(False, plan.get("error") or "exchange_invalid", plan)
        r = adj.TradeResolver.apply_exchange(bag, plan)
        if r.get("event"):
            emitted.append(r["event"])
        return done(bool(r.get("ok")), r.get("error") or "exchanged", {"plan": plan, "applied": r})

    if canon == "craft_tick":
        r = castro.craft_tick(cst, payload.get("castro_id"))
        if r.get("ok"):
            oids = []
            chain = []
            for cid, info in (r.get("results") or {}).items():
                c = cst["castros"].get(cid) or {}
                lots.ensure_castro_lots(c)
                for oid in (c.get("lot_object_ids") or {}).values():
                    oids.append(oid)
                    chain.append(
                        ev.provenance_step(
                            relation=ev.REL_USED,
                            object_id=oid,
                            via="craft_tick",
                            reason="craft_points_accrued",
                            castro_id=cid,
                            craft_points=info.get("craft_points"),
                        )
                    )
                if c.get("object_id"):
                    oids.append(c["object_id"])
            evt = _emit(
                bag,
                event_type="craft_tick",
                verb=canon,
                reason="craft_points_accrued",
                actors=actors,
                object_ids=list(dict.fromkeys(oids)),
                after=r,
                provenance={
                    "source": "olissippo_verbs",
                    "runtime": "sim",
                    "note": "craft_uses_lots",
                    "chain": chain,
                },
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "craft_ticked", r)

    if canon == "unlock_craft":
        r = castro.unlock_craft(cst, payload["castro_id"])
        if r.get("ok"):
            c = cst["castros"].get(payload["castro_id"]) or {}
            lots.ensure_castro_lots(c)
            oids = [c.get("object_id")] + list((c.get("lot_object_ids") or {}).values())
            chain = [
                ev.provenance_step(
                    relation=ev.REL_USED,
                    object_id=oid,
                    via="unlock_craft",
                    reason="craft_tier_advanced",
                    craft_tier=r.get("craft_tier"),
                )
                for oid in oids
                if oid
            ]
            evt = _emit(
                bag,
                event_type="craft_unlock",
                verb=canon,
                reason="craft_tier_advanced",
                actors=actors,
                object_ids=[x for x in oids if x],
                after=r,
                provenance={
                    "source": "olissippo_verbs",
                    "runtime": "sim",
                    "note": "craft_unlock_uses_capability",
                    "chain": chain,
                },
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "craft_unlocked", r)


    if canon == "cast_succession_vote":
        kin_state = bag.setdefault("kin", kin.new_state())
        did = str(payload.get("gens_id") or payload.get("dynasty_id") or "")
        r = dynasty_clock.cast_succession_vote(
            kin_state, did, str(payload["voter"]), str(payload["nominee"])
        )
        if r.get("ok"):
            evt = _emit(
                bag,
                event_type="succession_vote",
                verb=canon,
                reason="elective_vote_cast",
                actors=actors or [str(payload["voter"])],
                after=r,
            )
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "vote_cast", r)

    if canon == "declare_absentee":
        kin_state = bag.setdefault("kin", kin.new_state())
        did = str(payload.get("gens_id") or payload.get("dynasty_id") or "")
        r = dynasty_clock.declare_absentee(kin_state, did, str(payload["steward_person_id"]))
        if r.get("ok"):
            evt = _emit(bag, event_type="absentee_declared", verb=canon, reason="declare_absentee", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "absentee", r)

    if canon == "return_from_absentee":
        kin_state = bag.setdefault("kin", kin.new_state())
        did = str(payload.get("gens_id") or payload.get("dynasty_id") or "")
        r = dynasty_clock.return_from_absentee(kin_state, did)
        if r.get("ok"):
            evt = _emit(bag, event_type="absentee_returned", verb=canon, reason="return_from_absentee", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "returned", r)

    if canon == "add_enemy":
        kin_state = bag.setdefault("kin", kin.new_state())
        r = dynasty_clock.add_enemy(
            kin_state, str(payload["a"]), str(payload["b"]), reason=str(payload.get("reason") or "declared_enemy")
        )
        if r.get("ok"):
            evt = _emit(bag, event_type="enemy_declared", verb=canon, reason=r.get("reason") or "declared_enemy", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "enemy_added", r)

    if canon == "add_obligation":
        kin_state = bag.setdefault("kin", kin.new_state())
        r = dynasty_clock.add_obligation(
            kin_state,
            str(payload.get("debtor") or payload["a"]),
            str(payload.get("creditor") or payload["b"]),
            reason=str(payload.get("reason") or "obligation"),
            note=payload.get("note"),
        )
        if r.get("ok"):
            evt = _emit(bag, event_type="obligation_added", verb=canon, reason=r.get("reason") or "obligation", actors=actors, after=r)
            emitted.append(evt)
        return done(bool(r.get("ok")), r.get("error") or "obligation_added", r)


    return done(False, "unhandled_verb", {"error": "unhandled_verb", "verb": verb, "canonical": canon})
