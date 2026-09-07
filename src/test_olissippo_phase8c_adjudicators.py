#!/usr/bin/env python3
"""Phase 8C — pure adjudicators: resolve≠mutate; dynasty clock 1 real day = 1 game month."""
from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_adjudicators as adj  # noqa: E402
import olissippo_castro as castro  # noqa: E402
import olissippo_council as council  # noqa: E402
import olissippo_kin as kin  # noqa: E402
import olissippo_lots as lots  # noqa: E402
import olissippo_verbs as verbs  # noqa: E402
import olissippo_world as ow  # noqa: E402


def test_resolve_season_pure_idempotent():
    orders = [
        {"unit_id": "u-oli", "power_id": "lusitani", "verb": "move", "at": "terr-olissippo", "target": "terr-tagus-scrub"},
        {"unit_id": "u-vet", "power_id": "vettones", "verb": "hold", "at": "terr-tagus-scrub"},
        {
            "unit_id": "u-cel",
            "power_id": "celtici",
            "verb": "support",
            "at": "terr-celtici-oppida",
            "support_for": "u-oli",
            "target": "terr-tagus-scrub",
        },
    ]
    bag = {"bandua": council.new_season_bag(), "events": [], "law_version": "hearthlaw-1"}
    snap = deepcopy(bag)
    r1 = adj.SeasonAdjudicator.resolve_season(bag, orders)
    r2 = adj.SeasonAdjudicator.resolve_season(bag, orders)
    assert r1 == r2
    assert r1.get("pure") is True
    assert bag == snap  # unchanged until apply
    adj.SeasonAdjudicator.apply_resolution(bag, r1)
    assert bag["bandua_last"]["positions"]["u-oli"] == "terr-tagus-scrub"
    assert bag != snap


def test_production_tick_pure_then_apply_mints_lots():
    bag = {"castro": castro.new_state(), "events": [], "law_version": "hearthlaw-1"}
    c = bag["castro"]["castros"]["castro-olissippo"]
    lots.ensure_castro_lots(c)
    before_ids = dict(c.get("lot_object_ids") or {})
    before_herd = int(c["lots"]["herd"]["qty"])
    snap = deepcopy(c)
    plan = adj.ProductionResolver.production_tick(
        c, works=c.get("works"), lots_view=c.get("lots"), law_version="hearthlaw-1", elapsed=1
    )
    assert plan["ok"] and plan.get("pure") is True
    assert c == snap  # pure
    assert plan["outputs"]
    applied = adj.ProductionResolver.apply_production(bag, "castro-olissippo", plan)
    assert applied["ok"]
    assert c["lots"]["herd"]["qty"] >= before_herd
    for res, oid in before_ids.items():
        assert c["lot_object_ids"][res] == oid
        assert c["lots"][res]["object_id"] == oid
        assert c["lots"][res]["is_nft"] is True
    assert any(e["event_type"] == "production_tick" for e in bag["events"])


def test_exchange_plan_then_apply_moves_lots():
    bag = {"castro": castro.new_state(), "events": [], "law_version": "hearthlaw-1"}
    c = bag["castro"]["castros"]["castro-olissippo"]
    lots.ensure_castro_lots(c)
    # ensure enough herd
    lots.mint_lot(c, castro_id="castro-olissippo", resource="herd", qty=20)
    herd_before = int(c["lots"]["herd"]["qty"])
    grain_before = int(c["lots"]["grain"]["qty"])
    snap_res = deepcopy(c["lots"])
    plan = adj.TradeResolver.exchange(
        offer={"castro_id": "castro-olissippo", "resource": "herd", "qty": 5},
        demand={"resource": "grain"},
        counterparty=None,
        venue="quay",
        constraints=None,
        bag_view={"castro": bag["castro"]},
    )
    assert plan["ok"] and plan.get("pure") is True
    assert c["lots"] == snap_res
    applied = adj.TradeResolver.apply_exchange(bag, plan)
    assert applied["ok"]
    assert c["lots"]["herd"]["qty"] == herd_before - 5
    assert c["lots"]["grain"]["qty"] > grain_before
    assert any(e["event_type"] == "exchange" for e in bag["events"])
    # lore alias
    alias = adj.TradeResolver.quay_barter({"castros": bag["castro"]["castros"]}, "castro-olissippo", "herd", "grain", 1)
    assert alias.get("ok") and alias.get("lore_alias") == "quay_barter"


def test_succession_eldest_child_deterministic():
    st = kin.new_state()
    holding = dict(st["holdings"]["terr-olissippo"])
    holding["territory_id"] = "terr-olissippo"
    deceased = holding["holder_person_id"]
    p1 = adj.succession_policy.resolve(holding, deceased, "hearthlaw-1", st)
    p2 = adj.succession_policy.resolve(holding, deceased, "hearthlaw-1", st)
    assert p1 == p2
    assert p1["ok"] and p1["heir"] == "kin-oli-chefe-heir"
    assert p1["reason"] == "eldest_living_child"
    assert st["persons"][deceased]["alive"] is True  # pure
    bag = {"kin": st, "events": [], "law_version": "hearthlaw-1"}
    applied = adj.SuccessionResolver.apply_succession(bag, p1)
    assert applied["ok"] and bag["kin"]["holdings"]["terr-olissippo"]["holder_person_id"] == "kin-oli-chefe-heir"
    assert bag["kin"]["persons"][deceased]["alive"] is False


def test_law_enact_bumps_law_version_and_events():
    bag = {"grove": __import__("olissippo_grove_lex").new_state(), "events": [], "law_version": "hearthlaw-1"}
    prop = adj.LawAdjudicator.propose_policy_change(
        bag,
        "acb-boutius-001",
        changes=[{"rule": "defaults.guest_tribute_rate", "from": 0.1, "to": 0.15}],
        prose_text="Raise guest tribute",
    )
    assert prop["ok"]
    pid = prop["proposal_id"]
    # quorum votes
    for v in ("a", "b", "c"):
        __import__("olissippo_grove_lex").vote_lex(bag["grove"], pid, v, True)
    plan = adj.LawAdjudicator.resolve_enact(bag, pid)
    assert plan["ok"] and plan.get("pure") is True
    assert plan["law_version"] == "hearthlaw-2"
    assert bag["law_version"] == "hearthlaw-1"  # pure
    applied = adj.LawAdjudicator.apply_enact(bag, plan)
    assert applied["ok"]
    assert bag["law_version"] == "hearthlaw-2"
    assert bag["policy"]["defaults"]["guest_tribute_rate"] == 0.15
    assert any(e["event_type"] == "law_enacted" and e["law_version"] == "hearthlaw-2" for e in bag["events"])


def test_claim_strength_inherited_gt_raid_trophy():
    inherited = adj.ClaimStrength.claim_strength({"kind": "inherited", "holder_person_id": "p1"}, subject="p1")
    raid = adj.ClaimStrength.claim_strength({"kind": "raid_trophy", "holder_person_id": "p1"}, subject="p1")
    assert inherited > raid
    gate = adj.ClaimStrength.validate_press("inherited", subject="p1")
    assert gate["ok"] and gate["strength"] >= gate["threshold"]


def test_dynasty_clock_12_months_plus_one_year():
    """André: 1 real day = 1 game month; 12 months → +1 age year."""
    bag = {"kin": kin.new_state(), "events": [], "law_version": "hearthlaw-1", "clock": adj.DynastyClock.default_clock()}
    heir = bag["kin"]["persons"]["kin-oli-chefe-heir"]
    before = int(heir["age_years"])
    plan = adj.DynastyClock.plan_advance(bag["kin"], bag["clock"], "hearthlaw-1", months=12)
    assert plan["ok"] and plan.get("pure") is True
    assert int(heir["age_years"]) == before  # pure
    delta = next(d for d in plan["age_deltas"] if d["person_id"] == "kin-oli-chefe-heir")
    assert delta["after_years"] == before + 1
    applied = adj.DynastyClock.apply_advance(bag, plan)
    assert applied["ok"]
    assert int(bag["kin"]["persons"]["kin-oli-chefe-heir"]["age_years"]) == before + 1
    assert bag["clock"]["game_month"] == 12
    assert bag["clock"]["real_day_equals_game_months"] == 1
    # verb path
    bag2 = {"kin": kin.new_state(), "events": [], "law_version": "hearthlaw-1"}
    y0 = int(bag2["kin"]["persons"]["kin-oli-chefe-eldest"]["age_years"])
    r = verbs.execute_verb(bag2, "advance_game_month", {"months": 12}, actor_subject_id="acb-boutius-001")
    assert r["ok"]
    assert int(bag2["kin"]["persons"]["kin-oli-chefe-eldest"]["age_years"]) == y0 + 1
    assert any(e.get("verb") == "advance_game_month" for e in bag2["events"])


def test_dynasty_death_fires_succession():
    bag = {"kin": kin.new_state(), "events": [], "law_version": "hearthlaw-1", "clock": adj.DynastyClock.default_clock()}
    # force elder near max age
    elder = bag["kin"]["persons"]["kin-oli-chefe-eldest"]
    elder["age_years"] = 69
    elder["age_months"] = 69 * 12
    plan = adj.DynastyClock.plan_advance(
        bag["kin"], bag["clock"], "hearthlaw-1", months=12, policy={"defaults": {"max_age_years": 70}, "succession_policy": {"resolve": "eldest_living_child", "fallback": "eldest_living_stirps_member"}}
    )
    assert "kin-oli-chefe-eldest" in plan["deaths"]
    assert any(s.get("heir") == "kin-oli-chefe-heir" for s in plan["succession_plans"] if s.get("ok"))
    adj.DynastyClock.apply_advance(bag, plan)
    assert bag["kin"]["persons"]["kin-oli-chefe-eldest"]["alive"] is False
    assert bag["kin"]["holdings"]["terr-olissippo"]["holder_person_id"] == "kin-oli-chefe-heir"


def test_verbs_wire_adjudicators():
    bag = {
        "bandua": council.new_season_bag(),
        "castro": castro.new_state(),
        "kin": kin.new_state(),
        "events": [],
        "law_version": "hearthlaw-1",
    }
    lots.ensure_castro_lots(bag["castro"]["castros"]["castro-olissippo"])
    lots.mint_lot(bag["castro"]["castros"]["castro-olissippo"], castro_id="castro-olissippo", resource="herd", qty=10)
    r = verbs.execute_verb(
        bag,
        "exchange",
        {"castro_id": "castro-olissippo", "give": "herd", "want": "grain", "amount": 2},
        actor_subject_id="acb-boutius-001",
    )
    assert r["ok"], r
    r2 = verbs.execute_verb(bag, "tick_production", {"castro_id": "castro-olissippo"}, actor_subject_id="acb-boutius-001")
    assert r2["ok"], r2


def test_world_phase_8c_and_clock_stamp():
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert w["phase"]["8c"] == "pure_adjudicators"
    assert w["clock"]["real_day_equals_game_months"] == 1
    assert w["clock"]["game_months_per_year"] == 12
    assert w["phase"].get("8f") == "gnu_graphical_mud_state_logic_peer"
    arch = (ROOT / "docs/OLISSIPPO-ENGINE-ARCHITECTURE.md").read_text()
    assert "Phase 8C" in arch and "pure adjudicators" in arch.lower()
    assert "1 real day" in arch and "game month" in arch


def test_graphical_mud_still_peer():
    import olissippo_mud_state as mud

    info = mud.engine_info()
    assert info["engine"] == "gnu_graphical_mud"
    assert ow.action_allowed("move")




def test_dual_head_via_adjudicator():
    import olissippo_dynasty_clock as dc
    st = kin.new_state()
    dc.ensure_player_dynasty(st, "pdyn-oli-chefe", owner_subject_id="acb-camala-001", owner_kind="acb")
    dc.ensure_player_dynasty(st, "pdyn-vetton-cattle", owner_subject_id="user-vetton-01", owner_kind="user")
    assert dc.set_dynasty_head(st, "pdyn-vetton-cattle", "kin-oli-chefe-heir")["ok"]
    holding = dict(st["holdings"]["terr-olissippo"])
    holding["territory_id"] = "terr-olissippo"
    holding["player_dynasty_id"] = "pdyn-oli-chefe"
    plan = adj.succession_policy.resolve(holding, "kin-oli-chefe-eldest", "hearthlaw-1", st)
    if plan.get("ok"):
        assert plan["heir"] != "kin-oli-chefe-heir"
    else:
        assert plan.get("error") in ("no_heir", "shared_successor_forbidden")
    bad = {
        "ok": True,
        "heir": "kin-oli-chefe-heir",
        "from": "kin-oli-chefe-eldest",
        "territory_id": "terr-olissippo",
        "player_dynasty_id": "pdyn-oli-chefe",
        "law": "eldest_living_child",
        "reason": "eldest_living_child",
    }
    bag = {"kin": st, "events": [], "law_version": "hearthlaw-1"}
    applied = adj.SuccessionResolver.apply_succession(bag, bad)
    assert applied.get("ok") is False and applied.get("error") == "shared_successor_forbidden"




def test_per_dynasty_law_via_grove_enact():
    import olissippo_dynasty_clock as dc
    bag = {"grove": __import__("olissippo_grove_lex").new_state(), "kin": kin.new_state(), "events": [], "law_version": "hearthlaw-1"}
    dc.ensure_player_dynasty(bag["kin"], "pdyn-oli-chefe", owner_subject_id="acb-camala-001", owner_kind="acb")
    assert dc.dynasty_law(bag["kin"], "pdyn-oli-chefe") == "eldest_living_child"
    prop = adj.LawAdjudicator.propose_policy_change(
        bag,
        "acb-camala-001",
        changes=[{
            "rule": "dynasties.pdyn-oli-chefe.succession_law",
            "from": "eldest_living_child",
            "to": "youngest_living_child",
            "owner_subject_id": "acb-camala-001",
        }],
        prose_text="Hall dynasty adopts youngest-child law",
    )
    assert prop["ok"]
    pid = prop["proposal_id"]
    for v in ("a", "b", "c"):
        __import__("olissippo_grove_lex").vote_lex(bag["grove"], pid, v, True)
    plan = adj.LawAdjudicator.resolve_enact(bag, pid)
    assert plan["ok"]
    applied = adj.LawAdjudicator.apply_enact(bag, plan)
    assert applied["ok"]
    assert dc.dynasty_law(bag["kin"], "pdyn-oli-chefe") == "youngest_living_child"
    assert bag["law_version"] == "hearthlaw-2"



if __name__ == "__main__":
    failed = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok", name)
            except Exception as e:
                failed += 1
                print("FAIL", name, type(e).__name__, e)
    raise SystemExit(1 if failed else 0)
