#!/usr/bin/env python3
"""Olissippo Phase 8C/8D — pure adjudicators (resolve/plan) separate from apply/mutate.

Hard rule: resolve_* / *_tick / exchange / claim_strength are PURE (no bag mutation).
apply_* mutates bag, mints STRATA lots / updates holdings / policy, and emits Events
(with law_version, reason, provenance chain steps). LLM interprets only.
"""
from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

import olissippo_castro as castro
import olissippo_dynasty_clock as dynasty_clock
import olissippo_claims as claims
import olissippo_council as council
import olissippo_events as ev
import olissippo_grove_lex as lex
import olissippo_kin as kin
import olissippo_lots as lots

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "contracts" / "mud" / "olissippo-policy-layer.json"

Resolution = dict[str, Any]
ProductionResult = dict[str, Any]
ExchangePlan = dict[str, Any]


@lru_cache(maxsize=1)
def load_policy() -> dict[str, Any]:
    data = json.loads(POLICY_PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    return data


def policy_snapshot(bag: dict[str, Any] | None = None) -> dict[str, Any]:
    """Effective policy: bag override merged over contract defaults."""
    base = deepcopy(load_policy()["policy"])
    if bag and isinstance(bag.get("policy"), dict):
        for k, v in bag["policy"].items():
            if isinstance(v, dict) and isinstance(base.get(k), dict):
                base[k] = {**base[k], **v}
            else:
                base[k] = deepcopy(v)
    if bag and bag.get("law_version"):
        base["law_version"] = bag["law_version"]
    return base


def _law_version(bag: dict[str, Any] | None = None, explicit: str | None = None) -> str:
    if explicit:
        return str(explicit)
    if bag and bag.get("law_version"):
        return str(bag["law_version"])
    return str(load_policy()["policy"]["law_version"])


def _bump_law_version(cur: str) -> str:
    base, _, num = cur.partition("-")
    try:
        n = int(num) + 1
    except ValueError:
        n = 2
    return f"{base or 'hearthlaw'}-{n}"


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
    provenance: dict[str, Any] | list[Any] | None = None,
) -> dict[str, Any]:
    clk = bag.get("clock") or (bag.get("kin") or {}).get("clock") or {}
    gm = game_month
    if gm is None:
        gm = clk.get("game_month")
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
        provenance=provenance,
    )
    ev.append_event(bag, evt)
    return evt


# ---------------------------------------------------------------------------
# SeasonAdjudicator — Bandua war-band season
# ---------------------------------------------------------------------------


class SeasonAdjudicator:
    """Wrap council pure resolve + apply. Escort remains a generalized order type."""

    @staticmethod
    def resolve_season(
        world_state: dict[str, Any] | None,
        orders: list[dict[str, Any]],
        data: dict[str, Any] | None = None,
    ) -> Resolution:
        """PURE — does not mutate world_state or any bag."""
        _ = world_state  # API surface for future multi-power world context
        resolution = council.resolve_season(orders, data)
        resolution = dict(resolution)
        resolution["pure"] = True
        resolution["adjudicator"] = "SeasonAdjudicator"
        return resolution

    @staticmethod
    def apply_resolution(bag: dict[str, Any], resolution: Resolution) -> dict[str, Any]:
        """Mutate bag with resolution positions / season bump + emit Event."""
        if not resolution.get("ok"):
            return {"ok": False, "error": resolution.get("error") or "bad_resolution"}
        before_target = bag.get("bandua") if isinstance(bag.get("bandua"), dict) else bag
        before_pos = dict((before_target or {}).get("positions") or {})
        before_season = (before_target or {}).get("season")
        applied = council.apply_resolution(bag, resolution)
        if not applied.get("ok"):
            return {"ok": False, "error": applied.get("error") or "apply_failed"}
        causes = []
        if bag.get("last_event_id"):
            causes.append(str(bag["last_event_id"]))
        evt = _emit(
            bag,
            event_type="season_resolved",
            verb="bandua_resolve_season",
            reason=str(resolution.get("reason") or "pure_resolve_then_apply"),
            before={"positions": before_pos, "season": before_season},
            after={
                "positions": resolution.get("positions"),
                "moved": resolution.get("moved"),
                "bounced": resolution.get("bounced"),
                "season": applied.get("season"),
            },
            season=applied.get("season"),
            causes=causes,
            provenance={
                "source": "SeasonAdjudicator",
                "runtime": "sim",
                "note": "bandua_season_apply",
                "chain": [],
            },
        )
        return {
            "ok": True,
            "season": applied.get("season"),
            "positions": applied.get("positions"),
            "event": evt,
            "resolution": resolution,
        }

    @staticmethod
    def close_season(bag: dict[str, Any]) -> dict[str, Any]:
        """Close order collection (mutates). Prefer resolve then apply after close."""
        return council.close_season(bag)


# ---------------------------------------------------------------------------
# LawAdjudicator — HearthLaw / Grove typed policy changes
# ---------------------------------------------------------------------------


class LawAdjudicator:
    """Typed policy propose → pure enact plan → apply (bump law_version + event)."""

    @staticmethod
    def propose_policy_change(
        state: dict[str, Any],
        proposer: str,
        changes: list[dict[str, Any]],
        prose_text: str = "",
    ) -> dict[str, Any]:
        """Queue a Grove proposal with required typed changes[]; prose is display only."""
        if not changes or not isinstance(changes, list):
            return {"ok": False, "error": "typed_changes_required"}
        for ch in changes:
            if not isinstance(ch, dict) or not ch.get("rule"):
                return {"ok": False, "error": "bad_change", "detail": ch}
            if "from" not in ch or "to" not in ch:
                return {"ok": False, "error": "change_needs_from_to", "detail": ch}
        grove = state.setdefault("grove", lex.new_state())
        text = prose_text or f"policy_change:{len(changes)}_rules"
        r = lex.propose_lex(grove, proposer, text, target_id=None, replace=False)
        if not r.get("ok"):
            return r
        pid = r["proposal_id"]
        grove["proposals"][pid]["changes"] = deepcopy(changes)
        grove["proposals"][pid]["prose_text"] = prose_text
        grove["proposals"][pid]["kind"] = "policy_change"
        return {"ok": True, "proposal_id": pid, "proposal": deepcopy(grove["proposals"][pid])}

    @staticmethod
    def resolve_enact(
        state: dict[str, Any],
        proposal_id: str,
        votes: dict[str, bool] | None = None,
    ) -> dict[str, Any]:
        """PURE plan — does not mutate state. Returns {ok, new_policy, law_version, ...}."""
        grove = (state or {}).get("grove") or {}
        prop = (grove.get("proposals") or {}).get(proposal_id)
        if not prop or prop.get("status") != "open":
            return {"ok": False, "error": "not_open"}
        vote_map = votes if votes is not None else dict((grove.get("votes") or {}).get(proposal_id) or {})
        pol = policy_snapshot(state)
        quorum = int(pol.get("defaults", {}).get("vote_quorum") or lex.load_lex()["proposal"]["quorum"])
        majority = float(pol.get("defaults", {}).get("vote_majority") or lex.load_lex()["proposal"]["majority"])
        if len(vote_map) < quorum:
            return {"ok": False, "error": "no_quorum", "votes": len(vote_map), "need": quorum, "pure": True}
        ayes = sum(1 for v in vote_map.values() if v)
        if ayes / len(vote_map) <= majority:
            return {"ok": False, "error": "no_majority", "ayes": ayes, "total": len(vote_map), "pure": True}

        cur_lv = _law_version(state)
        new_lv = _bump_law_version(cur_lv)
        new_policy = deepcopy(pol)
        new_policy["law_version"] = new_lv
        changes = list(prop.get("changes") or [])
        dynasty_changes = []
        for ch in changes:
            rule = str(ch["rule"])
            if rule.startswith("dynasties.") or rule.startswith("succession_law."):
                dynasty_changes.append(ch)
                continue
            # dotted path under policy (e.g. defaults.guest_tribute_rate or succession_policy.resolve)
            parts = rule.split(".")
            cursor: Any = new_policy
            for p in parts[:-1]:
                if not isinstance(cursor, dict) or p not in cursor:
                    return {"ok": False, "error": "unknown_rule", "rule": rule, "pure": True}
                cursor = cursor[p]
            leaf = parts[-1]
            if not isinstance(cursor, dict) or leaf not in cursor:
                return {"ok": False, "error": "unknown_rule", "rule": rule, "pure": True}
            if cursor[leaf] != ch.get("from"):
                if str(cursor[leaf]) != str(ch.get("from")):
                    return {
                        "ok": False,
                        "error": "from_mismatch",
                        "rule": rule,
                        "expected": cursor[leaf],
                        "got": ch.get("from"),
                        "pure": True,
                    }
            cursor[leaf] = deepcopy(ch["to"])

        return {
            "ok": True,
            "pure": True,
            "proposal_id": proposal_id,
            "changes": changes,
            "dynasty_changes": dynasty_changes,
            "new_policy": new_policy,
            "law_version": new_lv,
            "prose_text": prop.get("prose_text") or prop.get("text"),
            "adjudicator": "LawAdjudicator",
        }

    @staticmethod
    def apply_enact(bag: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
        """Mutate policy + bump law_version + mark grove proposal enacted + emit event."""
        if not plan.get("ok"):
            return {"ok": False, "error": plan.get("error") or "bad_plan"}
        grove = bag.setdefault("grove", lex.new_state())
        pid = plan["proposal_id"]
        prop = grove.get("proposals", {}).get(pid)
        if prop:
            prop["status"] = "enacted"
            # also apply grove mutable add for bridge (prose surface)
            if not prop.get("changes"):
                # legacy path already handled elsewhere
                pass
            else:
                # keep typed changes on enacted proposal
                prop["enacted_law_version"] = plan["law_version"]
            # mirror into mutable lex as display rule
            grove.setdefault("mutable", []).append(
                {
                    "id": f"lex-policy-{pid}",
                    "text": plan.get("prose_text") or f"enacted {pid}",
                    "status": "active",
                    "changes": deepcopy(plan.get("changes") or []),
                }
            )
        # Per-dynasty succession_law via typed changes (dynasties.<id>.succession_law)
        kin_state = bag.setdefault("kin", kin.new_state())
        for ch in plan.get("changes") or []:
            rule = str(ch.get("rule") or "")
            pdid = None
            if rule.startswith("dynasties.") and rule.endswith(".succession_law"):
                parts = rule.split(".")
                if len(parts) == 3:
                    pdid = parts[1]
            elif rule.startswith("succession_law."):
                pdid = rule.split(".", 1)[1]
            elif rule == "succession_law":
                pdid = ch.get("player_dynasty_id") or ch.get("dynasty_id")
            if pdid:
                if pdid not in (kin_state.get("player_dynasties") or {}):
                    owner = ch.get("owner_subject_id") or "acb-unknown"
                    kind = "acb" if str(owner).startswith("acb-") else "user"
                    dynasty_clock.ensure_player_dynasty(kin_state, pdid, owner_subject_id=owner, owner_kind=kind)
                dynasty_clock.set_dynasty_succession_law(kin_state, pdid, ch.get("to"))
        bag["policy"] = deepcopy(plan["new_policy"])
        bag["law_version"] = plan["law_version"]
        evt = _emit(
            bag,
            event_type="law_enacted",
            verb="enact_law",
            reason="policy_enacted_law_version_bumped",
            after={
                "proposal_id": pid,
                "law_version": plan["law_version"],
                "changes": plan.get("changes"),
            },
        )
        return {"ok": True, "law_version": plan["law_version"], "event": evt, "policy": bag["policy"]}


# ---------------------------------------------------------------------------
# SuccessionResolver — policy-driven heir (not hardcoded forever)
# ---------------------------------------------------------------------------


class succession_policy:
    """Namespace matching architecture: succession_policy.resolve(...).

    Uses olissippo_dynasty_clock (per-dynasty law + unique head). Does not hardcode forever.
    """

    @staticmethod
    def resolve(
        holding: dict[str, Any],
        deceased_subject_or_person: str,
        law_version: str,
        kin_state: dict[str, Any],
        *,
        policy: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """PURE — {heir, reason}. Law from dynasty / HearthLaw default."""
        _ = policy
        snap = deepcopy(kin_state)
        holder = deceased_subject_or_person or (holding or {}).get("holder_person_id")
        if holder and holder in (snap.get("persons") or {}):
            snap["persons"][holder] = dict(snap["persons"][holder])
            snap["persons"][holder]["alive"] = False
        tid = (holding or {}).get("territory_id")
        if not tid:
            for t_id, h in (snap.get("holdings") or {}).items():
                if h.get("holder_person_id") == holder or (
                    holding and h.get("stirps_id") == holding.get("stirps_id")
                ):
                    # prefer exact holder match
                    if h.get("holder_person_id") == holder or holder == deceased_subject_or_person:
                        tid = t_id
                        if h.get("holder_person_id") == holder:
                            break
        if not tid:
            return {"ok": False, "error": "no_holding", "heir": None, "reason": "no_holding", "pure": True}
        # keep holder id on snap holding for resolve
        snap.setdefault("holdings", {}).setdefault(tid, dict(holding or snap["holdings"].get(tid) or {}))
        snap["holdings"][tid]["holder_person_id"] = holder
        pdid = (holding or {}).get("player_dynasty_id") or snap["holdings"][tid].get("player_dynasty_id")
        law = None
        if pdid and pdid in (snap.get("player_dynasties") or {}):
            law = dynasty_clock.dynasty_law(snap, pdid)
        plan = dynasty_clock.resolve_succession(snap, tid, law=law, law_version=law_version)
        plan = dict(plan)
        plan["law_version"] = law_version
        plan["player_dynasty_id"] = pdid
        plan["adjudicator"] = "SuccessionResolver"
        if plan.get("ok") and pdid:
            gate = dynasty_clock.assert_unique_dynasty_head(snap, plan["heir"], pdid)
            if not gate.get("ok"):
                # try next eligible
                for cand in plan.get("eligible") or []:
                    if cand == plan["heir"]:
                        continue
                    if dynasty_clock.assert_unique_dynasty_head(snap, cand, pdid).get("ok"):
                        plan["heir"] = cand
                        plan["reason"] = f"{plan.get('law')}+unique_head_skip"
                        break
                else:
                    return {**gate, "pure": True, "law_version": law_version}
        if plan.get("ok"):
            plan["reason"] = plan.get("law") or plan.get("reason")
        return plan


class SuccessionResolver:
    resolve = staticmethod(succession_policy.resolve)  # type: ignore[assignment]

    @staticmethod
    def apply_succession(bag: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
        """Mutate holdings + mark deceased + emit event (unique-head via dynasty_clock)."""
        if not plan.get("ok"):
            return {"ok": False, "error": plan.get("error") or "bad_plan"}
        kin_state = bag.setdefault("kin", kin.new_state())
        territory_id = plan.get("territory_id")
        if not territory_id:
            deceased = plan.get("from")
            for tid, h in (kin_state.get("holdings") or {}).items():
                if h.get("holder_person_id") == deceased:
                    territory_id = tid
                    break
        if not territory_id or territory_id not in kin_state.get("holdings", {}):
            return {"ok": False, "error": "no_holding"}
        pdid = plan.get("player_dynasty_id") or kin_state["holdings"][territory_id].get("player_dynasty_id")
        if pdid:
            if pdid not in (kin_state.get("player_dynasties") or {}):
                dynasty_clock.ensure_player_dynasty(
                    kin_state, pdid, owner_subject_id="acb-unknown", owner_kind="acb"
                )
            gate = dynasty_clock.assert_unique_dynasty_head(kin_state, plan["heir"], pdid)
            if not gate.get("ok"):
                return gate
        applied = dynasty_clock.apply_succession(
            kin_state,
            {
                **plan,
                "territory_id": territory_id,
                "law": plan.get("law") or plan.get("reason") or "eldest_living_child",
            },
        )
        if not applied.get("ok"):
            return applied
        if pdid:
            dynasty_clock.set_dynasty_head(kin_state, pdid, plan["heir"])
        deceased = plan.get("from")
        hp = kin_state.get("persons", {}).get(deceased)
        if hp:
            hp["alive"] = False
        before = {"holder_person_id": deceased, "territory_id": territory_id, "player_dynasty_id": pdid}
        evt = _emit(
            bag,
            event_type="succession",
            verb="succeed_holding",
            reason=f"succession_policy:{plan.get('reason') or plan.get('law')}",
            location_ids=[territory_id],
            before=before,
            after={
                "heir": plan["heir"],
                "territory_id": territory_id,
                "reason": plan.get("reason") or plan.get("law"),
                "player_dynasty_id": pdid,
                "law": plan.get("law"),
            },
        )
        return {
            "ok": True,
            "territory_id": territory_id,
            "heir": plan["heir"],
            "from": deceased,
            "reason": plan.get("reason") or plan.get("law"),
            "player_dynasty_id": pdid,
            "event": evt,
        }


# ---------------------------------------------------------------------------
# ProductionResolver — pure tick then mint lots
# ---------------------------------------------------------------------------


class ProductionResolver:
    @staticmethod
    def production_tick(
        castro_obj: dict[str, Any],
        works: dict[str, Any] | None = None,
        lots_view: dict[str, Any] | None = None,
        law_version: str = "hearthlaw-1",
        elapsed: int = 1,
    ) -> ProductionResult:
        """PURE — outputs list of {object_class, quantity}. Does not mutate castro."""
        _ = lots_view  # reserved for future lot-capacity caps
        c = dict(castro_obj)
        if works is not None:
            c = {**c, "works": works}
        rates = castro.production_rates(c)
        elapsed = max(0, int(elapsed))
        outputs = [
            {"object_class": res, "quantity": int(qty) * elapsed, "resource": res}
            for res, qty in rates.items()
            if int(qty) * elapsed > 0
        ]
        return {
            "ok": True,
            "pure": True,
            "outputs": outputs,
            "rates": rates,
            "elapsed": elapsed,
            "castro_id": castro_obj.get("castro_id"),
            "law_version": law_version,
            "adjudicator": "ProductionResolver",
        }

    @staticmethod
    def apply_production(bag: dict[str, Any], castro_id: str, result: ProductionResult) -> dict[str, Any]:
        """Mint STRATA lots via olissippo_lots + update aggregates + event."""
        if not result.get("ok"):
            return {"ok": False, "error": result.get("error") or "bad_result"}
        cst = bag.setdefault("castro", castro.new_state())
        c = cst["castros"].get(castro_id)
        if not c:
            return {"ok": False, "error": "unknown_castro", "castro_id": castro_id}
        lots.ensure_castro_lots(c)
        minted = []
        before = {r: int((c.get("lots") or {}).get(r, {}).get("qty") or c.get("resources", {}).get(r, 0)) for r in lots.RESOURCE_KINDS}
        for item in result.get("outputs") or []:
            res = item.get("object_class") or item.get("resource")
            qty = int(item.get("quantity") or 0)
            if not res or qty <= 0:
                continue
            m = lots.mint_lot(c, castro_id=castro_id, resource=res, qty=qty, holder_subject=c.get("holder_subject"))
            if m.get("ok"):
                minted.append(m)
        lots.sync_resources_from_lots(c)
        cst["tick"] = int(cst.get("tick") or 0) + int(result.get("elapsed") or 1)
        obj_ids = [c.get("object_id")] + list((c.get("lot_object_ids") or {}).values())
        chain = [
            ev.provenance_step(
                relation=ev.REL_CREATED,
                object_id=m["lot"]["object_id"],
                via="tick_production",
                reason="production_mints_strata_lots",
                resource=m["lot"]["resource"],
                qty=m.get("minted"),
            )
            for m in minted
            if m.get("lot", {}).get("object_id")
        ]
        evt = _emit(
            bag,
            event_type="production_tick",
            verb="tick_production",
            reason="production_mints_strata_lots",
            object_ids=[x for x in obj_ids if x],
            before={"resources": before},
            after={"outputs": result.get("outputs"), "minted": [{"resource": m["lot"]["resource"], "after": m["after"], "object_id": m["lot"]["object_id"]} for m in minted]},
            provenance={
                "source": "ProductionResolver",
                "runtime": "sim",
                "note": "mint_strata_lots",
                "chain": chain,
            },
        )
        return {
            "ok": True,
            "castro_id": castro_id,
            "minted": minted,
            "lot_object_ids": dict(c.get("lot_object_ids") or {}),
            "event": evt,
            "aggregates": lots.aggregates(c),
        }


# ---------------------------------------------------------------------------
# TradeResolver — pure exchange plan then transfer lots
# ---------------------------------------------------------------------------


class TradeResolver:
    @staticmethod
    def exchange(
        offer: dict[str, Any],
        demand: dict[str, Any],
        counterparty: str | None,
        venue: str,
        constraints: dict[str, Any] | None,
        bag_view: dict[str, Any],
    ) -> ExchangePlan:
        """PURE validation of ownership/rates → ExchangePlan. No mutation."""
        _ = constraints
        d = castro.load_castro()
        give = offer.get("resource") or offer.get("give")
        amount = int(offer.get("qty") or offer.get("amount") or 0)
        want = demand.get("resource") or demand.get("want")
        castro_id = offer.get("castro_id") or (bag_view.get("castro_id") if bag_view else None)
        if not castro_id or not give or not want:
            return {"ok": False, "error": "missing_fields", "pure": True}
        if amount <= 0:
            return {"ok": False, "error": "bad_amount", "pure": True}
        cst = (bag_view or {}).get("castro") or bag_view
        c = None
        if isinstance(cst, dict) and "castros" in cst:
            c = cst["castros"].get(castro_id)
        elif isinstance(cst, dict) and cst.get("castro_id") == castro_id:
            c = cst
        if not c:
            return {"ok": False, "error": "unknown_castro", "pure": True}
        pair = [give, want]
        if pair not in (d["barter"].get("allowed_pairs") or []):
            return {"ok": False, "error": "pair_forbidden", "pure": True}
        key = f"{give}->{want}"
        rate = float((d["barter"].get("rate") or {}).get(key) or 0)
        if rate <= 0:
            return {"ok": False, "error": "no_rate", "pure": True}
        # ownership check via lots or resources view (read-only)
        have = 0
        if c.get("lots") and give in c["lots"]:
            have = int(c["lots"][give].get("qty") or 0)
        else:
            have = int((c.get("resources") or {}).get(give, 0))
        if have < amount:
            return {"ok": False, "error": "insufficient_resources", "have": have, "need": amount, "pure": True}
        fee = float(d["barter"].get("fee_fraction") or 0)
        got = int(amount * rate * (1.0 - fee))
        if got <= 0:
            return {"ok": False, "error": "dust", "pure": True}
        to_castro = None
        if counterparty and isinstance(cst, dict) and "castros" in cst and counterparty in cst["castros"]:
            to_castro = counterparty
        return {
            "ok": True,
            "pure": True,
            "castro_id": castro_id,
            "counterparty": to_castro,
            "venue": venue or "quay",
            "give": give,
            "want": want,
            "amount": amount,
            "received_qty": got,
            "rate": rate,
            "fee_fraction": fee,
            "from_lot": lots.lot_object_id(castro_id, give),
            "to_lot": lots.lot_object_id(to_castro or castro_id, want),
            "adjudicator": "TradeResolver",
            "lore_alias": "quay_barter" if (venue or "quay") in ("quay", "market", "quay_barter") else None,
        }

    @staticmethod
    def apply_exchange(bag: dict[str, Any], plan: ExchangePlan) -> dict[str, Any]:
        """Transfer / swap lots + emit event."""
        if not plan.get("ok"):
            return {"ok": False, "error": plan.get("error") or "bad_plan"}
        cst = bag.setdefault("castro", castro.new_state())
        cid = plan["castro_id"]
        c = cst["castros"].get(cid)
        if not c:
            return {"ok": False, "error": "unknown_castro"}
        lots.ensure_castro_lots(c)
        give, want = plan["give"], plan["want"]
        amount, got = int(plan["amount"]), int(plan["received_qty"])
        if plan.get("counterparty") and plan["counterparty"] in cst["castros"]:
            other = cst["castros"][plan["counterparty"]]
            t = lots.transfer_lot(c, other, give, amount)
            if not t.get("ok"):
                return t
            # counterparty pays want back (simple 1:1 swap of planned qty)
            t2 = lots.transfer_lot(other, c, want, got)
            if not t2.get("ok"):
                # rollback give
                lots.transfer_lot(other, c, give, amount)
                return t2
        else:
            # quay market: burn give lot qty, mint want lot qty on same castro
            src = c["lots"][give]
            if int(src["qty"]) < amount:
                return {"ok": False, "error": "insufficient_lot"}
            src["qty"] = int(src["qty"]) - amount
            c.setdefault("resources", {})[give] = src["qty"]
            m = lots.mint_lot(c, castro_id=cid, resource=want, qty=got, holder_subject=c.get("holder_subject"))
            if not m.get("ok"):
                src["qty"] = int(src["qty"]) + amount
                c["resources"][give] = src["qty"]
                return m
            lots.sync_resources_from_lots(c)
        obj_ids = [c.get("object_id")] + list((c.get("lot_object_ids") or {}).values())
        chain = []
        if plan.get("from_lot"):
            chain.append(
                ev.provenance_step(
                    relation=ev.REL_TRANSFERRED,
                    object_id=plan["from_lot"],
                    via="exchange",
                    reason="spent_lot_qty",
                    qty=amount,
                    resource=give,
                )
            )
        if plan.get("to_lot"):
            chain.append(
                ev.provenance_step(
                    relation=ev.REL_CREATED if not plan.get("counterparty") else ev.REL_TRANSFERRED,
                    object_id=plan["to_lot"],
                    via="exchange",
                    reason="received_lot_qty",
                    qty=got,
                    resource=want,
                )
            )
        evt = _emit(
            bag,
            event_type="exchange",
            verb="exchange",
            reason="quay_barter_lore_instance_of_exchange" if plan.get("lore_alias") == "quay_barter" else "exchange_lots",
            object_ids=[x for x in obj_ids if x],
            location_ids=[plan.get("venue") or "quay", "market"],
            after={
                "spent": {give: amount},
                "received": {want: got},
                "fee_fraction": plan.get("fee_fraction"),
                "from_lot": plan.get("from_lot"),
                "to_lot": plan.get("to_lot"),
            },
            provenance={
                "source": "TradeResolver",
                "runtime": "sim",
                "note": "lot_exchange",
                "chain": chain,
            },
        )
        return {
            "ok": True,
            "spent": {give: amount},
            "received": {want: got},
            "fee_fraction": plan.get("fee_fraction"),
            "event": evt,
            "mechanic": "castro_hearth",
        }

    @staticmethod
    def quay_barter(
        bag_view: dict[str, Any],
        castro_id: str,
        give: str,
        want: str,
        amount: int,
    ) -> ExchangePlan:
        """Lore alias — pure plan via exchange()."""
        return TradeResolver.exchange(
            offer={"castro_id": castro_id, "resource": give, "qty": amount},
            demand={"resource": want},
            counterparty=None,
            venue="quay",
            constraints=None,
            bag_view=bag_view if "castros" in (bag_view or {}) else {"castro": bag_view},
        )


# ---------------------------------------------------------------------------
# ClaimStrength — supporting
# ---------------------------------------------------------------------------


class ClaimStrength:
    @staticmethod
    def claim_strength(
        claim: dict[str, Any],
        subject: str | None = None,
        obj: dict[str, Any] | str | None = None,
        law: dict[str, Any] | str | None = None,
        edges: list[dict[str, Any]] | None = None,
        events: list[dict[str, Any]] | None = None,
    ) -> float:
        """Base strength from claims contract + simple modifiers."""
        _ = obj
        d = claims.load_claims()
        kind = (claim or {}).get("kind") or "raid_trophy"
        base = float((d.get("strength") or {}).get(kind) or 1)
        # policy overlay if present for same kind key
        pol = load_policy()["policy"]
        if isinstance(law, dict) and "claim_strength_base" in law:
            base = float((law.get("claim_strength_base") or {}).get(kind, base))
        elif kind in (pol.get("claim_strength_base") or {}):
            # only overlay when policy uses same kind id
            base = float(pol["claim_strength_base"][kind])
        score = base
        # simple modifiers
        holder = (claim or {}).get("holder_person_id")
        if subject and holder and subject == holder:
            score += 0.5
        if edges:
            for e in edges:
                if e.get("kind") in ("parent_of", "child_of", "spouse_of") and kind == "inherited":
                    score += 0.25
                    break
                if e.get("kind") == "oath_kin" and kind in ("guest_oath", "marriage"):
                    score += 0.25
                    break
        if events:
            # prior successful presses slightly reinforce
            for evt in events[-5:]:
                if evt.get("event_type") == "claim_pressed" and (claim or {}).get("claim_id") in str(
                    evt.get("after") or {}
                ):
                    score += 0.1
                    break
        return float(score)

    @staticmethod
    def press_threshold(policy: dict[str, Any] | None = None) -> float:
        pol = policy or load_policy()["policy"]
        defaults = pol.get("defaults") or {}
        if "press_claim_min_strength" in defaults:
            return float(defaults["press_claim_min_strength"])
        # weakest known kind from claims contract
        d = claims.load_claims()
        strengths = list((d.get("strength") or {}).values()) or [1]
        return float(min(strengths))

    @staticmethod
    def validate_press(
        claim_kind: str,
        subject: str | None = None,
        *,
        policy: dict[str, Any] | None = None,
        edges: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        strength = ClaimStrength.claim_strength(
            {"kind": claim_kind, "holder_person_id": subject},
            subject=subject,
            edges=edges,
            law=policy,
        )
        thr = ClaimStrength.press_threshold(policy)
        if strength < thr:
            return {"ok": False, "error": "below_claim_threshold", "strength": strength, "threshold": thr}
        return {"ok": True, "strength": strength, "threshold": thr}


# ---------------------------------------------------------------------------
# DynastyClock — 1 real day = 1 game month (CK2-like dynasty time)
# ---------------------------------------------------------------------------


class DynastyClock:
    """Advance game months: age persons; fire succession on death.

    Mapping (André): 1 real calendar day ≡ 1 game month for dynasty/succession.
    12 game months ≡ +1 age_year.
    """

    REAL_DAY_EQUALS_GAME_MONTHS = 1
    GAME_MONTHS_PER_YEAR = 12

    @staticmethod
    def default_clock() -> dict[str, Any]:
        return {
            "game_year": 1,
            "game_month": 0,  # months elapsed in absolute terms; year = month // 12 + 1 display
            "real_day_equals_game_months": DynastyClock.REAL_DAY_EQUALS_GAME_MONTHS,
            "game_months_per_year": DynastyClock.GAME_MONTHS_PER_YEAR,
            "note": "1 real day = 1 game month (CK2-like dynasty clock)",
        }

    @staticmethod
    def ensure_person_age(person: dict[str, Any], default_years: int | None = None) -> dict[str, Any]:
        """Ensure age_years + age_months on person (mutates person; used at seed hydrate)."""
        if "age_years" not in person:
            gen = int(person.get("generation") or 0)
            # gen 0 ~ 40y, gen 1 ~ 18y unless seeded
            person["age_years"] = int(default_years if default_years is not None else (40 if gen == 0 else 18))
        if "age_months" not in person:
            person["age_months"] = int(person["age_years"]) * DynastyClock.GAME_MONTHS_PER_YEAR
        else:
            # keep years in sync with months
            person["age_years"] = int(person["age_months"]) // DynastyClock.GAME_MONTHS_PER_YEAR
        return person

    @staticmethod
    def plan_advance(
        kin_state: dict[str, Any],
        clock: dict[str, Any] | None,
        law_version: str,
        months: int = 1,
        policy: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """PURE — ages, deaths, succession plans. Does not mutate kin_state/clock."""
        months = int(months)
        if months <= 0:
            return {"ok": False, "error": "bad_months", "pure": True}
        pol = policy or load_policy()["policy"]
        max_age = int((pol.get("defaults") or {}).get("max_age_years") or 70)
        clk = dict(clock or DynastyClock.default_clock())
        persons_snap = deepcopy(kin_state.get("persons") or {})
        holdings_snap = deepcopy(kin_state.get("holdings") or {})
        age_deltas: list[dict[str, Any]] = []
        deaths: list[str] = []
        for pid, p in persons_snap.items():
            if not p.get("alive"):
                continue
            DynastyClock.ensure_person_age(p)
            before_years = int(p["age_years"])
            before_months = int(p["age_months"])
            after_months = before_months + months
            after_years = after_months // DynastyClock.GAME_MONTHS_PER_YEAR
            age_deltas.append(
                {
                    "person_id": pid,
                    "before_years": before_years,
                    "after_years": after_years,
                    "before_months": before_months,
                    "after_months": after_months,
                }
            )
            p["age_months"] = after_months
            p["age_years"] = after_years
            if after_years >= max_age:
                deaths.append(pid)

        succession_plans: list[dict[str, Any]] = []
        # Treat deaths as not alive for pure succession resolve
        for did in deaths:
            persons_snap[did]["alive"] = False
        for did in deaths:
            for tid, holding in holdings_snap.items():
                if holding.get("holder_person_id") != did:
                    continue
                h = dict(holding)
                h["territory_id"] = tid
                plan = succession_policy.resolve(
                    h,
                    did,
                    law_version,
                    {"persons": persons_snap, "holdings": holdings_snap, "edges": list(kin_state.get("edges") or [])},
                    policy=pol,
                )
                plan = dict(plan)
                plan["territory_id"] = tid
                succession_plans.append(plan)
                if plan.get("ok") and plan.get("heir"):
                    # update snap so chained deaths in same tick see new holder
                    holdings_snap[tid]["holder_person_id"] = plan["heir"]

        new_month = int(clk.get("game_month") or 0) + months
        return {
            "ok": True,
            "pure": True,
            "months": months,
            "law_version": law_version,
            "age_deltas": age_deltas,
            "deaths": deaths,
            "succession_plans": succession_plans,
            "clock_before": {"game_month": int(clk.get("game_month") or 0), "game_year": int(clk.get("game_year") or 1)},
            "clock_after": {
                "game_month": new_month,
                "game_year": new_month // DynastyClock.GAME_MONTHS_PER_YEAR + 1,
                "real_day_equals_game_months": DynastyClock.REAL_DAY_EQUALS_GAME_MONTHS,
                "game_months_per_year": DynastyClock.GAME_MONTHS_PER_YEAR,
            },
            "max_age_years": max_age,
            "adjudicator": "DynastyClock",
        }

    @staticmethod
    @staticmethod
    def apply_succession_law(bag: dict[str, Any], dynasty_id: str, law: str) -> dict[str, Any]:
        """Mutate per-dynasty Nomic succession law + emit Event (law_version stamped)."""
        kin_state = bag.setdefault("kin", kin.new_state())
        r = dynasty_clock.set_dynasty_succession_law(kin_state, dynasty_id, law)
        if not r.get("ok"):
            return r
        evt = _emit(
            bag,
            event_type="dynasty_law_set",
            verb="set_dynasty_succession_law",
            reason=str(r.get("reason") or "nomic_dynasty_succession_law"),
            actors=[(kin_state.get("player_dynasties") or {}).get(dynasty_id, {}).get("owner_subject_id") or ""],
            before={"succession_law": r.get("from"), "dynasty_id": dynasty_id},
            after={"succession_law": r.get("to"), "dynasty_id": dynasty_id},
            provenance={
                "source": "DynastyClock",
                "runtime": "sim",
                "note": "per_dynasty_nomic_law",
                "chain": [],
            },
        )
        r = dict(r)
        r["event"] = evt
        r["law_version"] = _law_version(bag)
        return r

    def apply_advance(bag: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
        """Mutate clock + ages; apply deaths and succession; emit events."""
        if not plan.get("ok"):
            return {"ok": False, "error": plan.get("error") or "bad_plan"}
        kin_state = bag.setdefault("kin", kin.new_state())
        for pid, p in (kin_state.get("persons") or {}).items():
            DynastyClock.ensure_person_age(p)
        for delta in plan.get("age_deltas") or []:
            p = kin_state["persons"].get(delta["person_id"])
            if not p:
                continue
            p["age_months"] = int(delta["after_months"])
            p["age_years"] = int(delta["after_years"])
        for did in plan.get("deaths") or []:
            p = kin_state["persons"].get(did)
            if p:
                p["alive"] = False
        applied_succ = []
        for sp in plan.get("succession_plans") or []:
            if not sp.get("ok"):
                continue
            r = SuccessionResolver.apply_succession(bag, sp)
            applied_succ.append(r)
        bag["clock"] = {
            **DynastyClock.default_clock(),
            **(bag.get("clock") or {}),
            **(plan.get("clock_after") or {}),
        }
        evt = _emit(
            bag,
            event_type="dynasty_tick",
            verb="advance_game_month",
            reason="real_day_equals_game_month_age_and_succession",
            before=plan.get("clock_before"),
            after={
                "clock": bag["clock"],
                "deaths": plan.get("deaths"),
                "successions": [
                    {"territory_id": s.get("territory_id"), "heir": s.get("heir"), "from": s.get("from")}
                    for s in applied_succ
                    if s.get("ok")
                ],
                "age_sample": (plan.get("age_deltas") or [])[:3],
            },
        )
        return {
            "ok": True,
            "clock": bag["clock"],
            "deaths": plan.get("deaths"),
            "successions": applied_succ,
            "event": evt,
            "months": plan.get("months"),
        }


# module-level aliases for ergonomic imports
resolve_season = SeasonAdjudicator.resolve_season
apply_resolution = SeasonAdjudicator.apply_resolution
propose_policy_change = LawAdjudicator.propose_policy_change
resolve_enact = LawAdjudicator.resolve_enact
apply_enact = LawAdjudicator.apply_enact
production_tick = ProductionResolver.production_tick
apply_production = ProductionResolver.apply_production
exchange = TradeResolver.exchange
apply_exchange = TradeResolver.apply_exchange
quay_barter = TradeResolver.quay_barter
claim_strength = ClaimStrength.claim_strength
plan_advance_game_month = DynastyClock.plan_advance
apply_advance_game_month = DynastyClock.apply_advance
dynasty_tick = DynastyClock.plan_advance  # pure alias
