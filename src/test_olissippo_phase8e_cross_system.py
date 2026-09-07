#!/usr/bin/env python3
"""Phase 8E — cross-system scenarios (not unit silos) + 8D provenance depth checks."""
from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_adjudicators as adj  # noqa: E402
import olissippo_castro as castro  # noqa: E402
import olissippo_claims as claims  # noqa: E402
import olissippo_council as council  # noqa: E402
import olissippo_dynasty_clock as dc  # noqa: E402
import olissippo_events as ev  # noqa: E402
import olissippo_kin as kin  # noqa: E402
import olissippo_lots as lots  # noqa: E402
import olissippo_mud_state as mud  # noqa: E402
import olissippo_verbs as verbs  # noqa: E402
import olissippo_world as ow  # noqa: E402


def _assert_event_shape(evt: dict) -> None:
    for k in (
        "event_id",
        "event_type",
        "verb",
        "law_version",
        "reason",
        "actor_subject_ids",
        "object_ids",
        "before",
        "after",
        "provenance",
        "causes",
    ):
        assert k in evt, f"missing {k}"
    assert evt["reason"] and evt["law_version"]
    explained = ev.explain_event(evt)
    assert explained["ok"] and explained["server_truth"] is True
    assert explained["resolution_reason"] == evt["reason"]
    assert "narration_seed" in explained


def test_phase_8d_provenance_helpers():
    bag = {"events": [], "law_version": "hearthlaw-1"}
    oid = "obj-oli-lot-castro-olissippo-grain"
    e1 = ev.make_event(
        event_type="production_tick",
        verb="tick_production",
        reason="production_mints_strata_lots",
        law_version="hearthlaw-1",
        object_ids=[oid],
        provenance=[
            ev.provenance_step(relation=ev.REL_CREATED, object_id=oid, via="tick_production"),
        ],
    )
    ev.append_event(bag, e1)
    e2 = ev.make_event(
        event_type="exchange",
        verb="exchange",
        reason="exchange_lots",
        law_version="hearthlaw-1",
        object_ids=[oid],
        provenance=[
            ev.provenance_step(relation=ev.REL_TRANSFERRED, object_id=oid, via="exchange"),
        ],
        causes=[e1["event_id"]],
    )
    ev.append_event(bag, e2)
    e3 = ev.make_event(
        event_type="craft_tick",
        verb="craft_tick",
        reason="craft_points_accrued",
        law_version="hearthlaw-1",
        object_ids=[oid],
        provenance=[
            ev.provenance_step(relation=ev.REL_USED, object_id=oid, via="craft_tick"),
        ],
        causes=[e2["event_id"]],
    )
    ev.append_event(bag, e3)
    chain = ev.provenance_chain(oid, bag["events"])
    assert chain, "chain must be non-empty"
    rels = [c["relation"] for c in chain]
    assert rels[0] == ev.REL_CREATED
    assert ev.REL_TRANSFERRED in rels
    assert ev.REL_USED in rels
    _assert_event_shape(e3)
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert w["phase"]["8d"] == "event_provenance_depth"
    assert w["phase"]["8e"] == "cross_system_scenarios"
    arch = (ROOT / "docs/OLISSIPPO-ENGINE-ARCHITECTURE.md").read_text()
    assert "Phase 8D" in arch and "provenance_chain" in arch
    assert "Phase 8E" in arch


def test_scenario_a_kinship_claim_bandua_holding_production():
    """kinship → claim → Bandua → holding/position → production + Events."""
    bag = {
        "kin": kin.new_state(),
        "claims": claims.new_state(),
        "bandua": council.new_season_bag(),
        "castro": castro.new_state(),
        "events": [],
        "law_version": "hearthlaw-1",
        "clock": adj.DynastyClock.default_clock(),
    }
    # 1. Two player dynasties (ACB + user) with unique heads
    assert dc.ensure_player_dynasty(
        bag["kin"], "pdyn-acb-oli", owner_subject_id="acb-boutius-001", owner_kind="acb"
    )["ok"]
    assert dc.ensure_player_dynasty(
        bag["kin"], "pdyn-user-andre", owner_subject_id="user-andre-001", owner_kind="user"
    )["ok"]
    assert dc.set_dynasty_head(bag["kin"], "pdyn-acb-oli", "kin-oli-chefe-eldest")["ok"]
    assert dc.set_dynasty_head(bag["kin"], "pdyn-user-andre", "kin-vetton-herd")["ok"]
    bad = dc.set_dynasty_head(bag["kin"], "pdyn-user-andre", "kin-oli-chefe-eldest")
    assert bad["ok"] is False and bad["error"] == "shared_successor_forbidden"
    bag["kin"]["holdings"]["terr-olissippo"]["player_dynasty_id"] = "pdyn-acb-oli"

    # 2. marry across stirps → press_claim (marriage kind)
    r_marry = verbs.execute_verb(
        bag,
        "marry",
        {"a": "kin-oli-chefe-heir", "b": "kin-vetton-herd"},
        actor_subject_id="acb-boutius-001",
    )
    assert r_marry["ok"], r_marry
    r_claim = verbs.execute_verb(
        bag,
        "press_claim",
        {
            "stirps_id": "stirps-oli-chefe",
            "territory_id": "terr-tagus-scrub",
            "kind": "marriage",
            "holder_person_id": "kin-oli-chefe-heir",
        },
        actor_subject_id="acb-boutius-001",
    )
    assert r_claim["ok"], r_claim

    # 3. submit_order support/move season → pure resolve → apply
    orders = [
        {
            "unit_id": "u-oli",
            "power_id": "lusitani",
            "verb": "move",
            "at": "terr-olissippo",
            "target": "terr-tagus-scrub",
        },
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
    snap = deepcopy(bag["bandua"])
    resolution = adj.SeasonAdjudicator.resolve_season(bag, orders)
    assert resolution["ok"] and resolution.get("pure") is True
    assert bag["bandua"] == snap
    applied = adj.SeasonAdjudicator.apply_resolution(bag, resolution)
    assert applied["ok"] and applied.get("event")
    _assert_event_shape(applied["event"])

    # 4. holding/title or position changes
    assert bag["bandua_last"]["positions"]["u-oli"] == "terr-tagus-scrub"
    # claim present (title pretension)
    assert any(c.get("kind") == "marriage" for c in bag["claims"]["claims"].values())

    # 5. production_tick mints STRATA lots under new control
    c = bag["castro"]["castros"]["castro-olissippo"]
    lots.ensure_castro_lots(c)
    # link control narrative: holder remains Subject; lots are STRATA
    c["holder_subject"] = "acb-boutius-001"
    before_herd = int(c["lots"]["herd"]["qty"])
    plan = adj.ProductionResolver.production_tick(
        c, works=c.get("works"), lots_view=c.get("lots"), law_version=bag["law_version"], elapsed=1
    )
    assert plan["ok"] and plan.get("pure") is True
    prod = adj.ProductionResolver.apply_production(bag, "castro-olissippo", plan)
    assert prod["ok"]
    assert c["lots"]["herd"]["qty"] >= before_herd
    assert c["lots"]["herd"]["is_nft"] is True and c["lots"]["herd"]["nft_family"] == "STRATA"
    herd_oid = c["lots"]["herd"]["object_id"]
    chain = ev.provenance_chain(herd_oid, bag["events"])
    assert chain and any(s["relation"] == ev.REL_CREATED for s in chain)

    # 6. Events emitted with law_version + reasons throughout
    assert len(bag["events"]) >= 4
    for evt in bag["events"]:
        _assert_event_shape(evt)
        assert evt["law_version"] == "hearthlaw-1"
    types = {e["event_type"] for e in bag["events"]}
    assert "kinship" in types
    assert "claim_pressed" in types
    assert "season_resolved" in types
    assert "production_tick" in types


def test_scenario_b_nomic_law_dynasty_succession():
    """Nomic succession law → advance/death → heir differs from eldest; unique head."""
    bag = {
        "kin": kin.new_state(),
        "events": [],
        "law_version": "hearthlaw-1",
        "clock": adj.DynastyClock.default_clock(),
    }
    # younger sibling for youngest law
    bag["kin"]["persons"]["kin-oli-chefe-younger"] = {
        "person_id": "kin-oli-chefe-younger",
        "stirps_id": "stirps-oli-chefe",
        "display_name": "Younger",
        "generation": 1,
        "alive": True,
        "parent_ids": ["kin-oli-chefe-eldest"],
        "age_months": 20 * 12,
        "age_years": 20,
    }
    bag["kin"]["persons"]["kin-oli-chefe-heir"]["age_months"] = 28 * 12
    bag["kin"]["persons"]["kin-oli-chefe-heir"]["age_years"] = 28

    assert dc.ensure_player_dynasty(
        bag["kin"], "pdyn-acb-oli", owner_subject_id="acb-boutius-001", owner_kind="acb"
    )["ok"]
    assert dc.ensure_player_dynasty(
        bag["kin"], "pdyn-user-andre", owner_subject_id="user-andre-001", owner_kind="user"
    )["ok"]
    # user dynasty already heads the elder's heir? put user on vetton; acb on eldest
    assert dc.set_dynasty_head(bag["kin"], "pdyn-acb-oli", "kin-oli-chefe-eldest")["ok"]
    assert dc.set_dynasty_head(bag["kin"], "pdyn-user-andre", "kin-vetton-herd")["ok"]
    bag["kin"]["holdings"]["terr-olissippo"]["player_dynasty_id"] = "pdyn-acb-oli"

    # 1. set_dynasty_succession_law to youngest
    law_r = adj.DynastyClock.apply_succession_law(bag, "pdyn-acb-oli", "youngest_living_child")
    assert law_r["ok"] and law_r["to"] == "youngest_living_child"
    assert law_r.get("event")
    _assert_event_shape(law_r["event"])
    assert dc.dynasty_law(bag["kin"], "pdyn-acb-oli") == "youngest_living_child"

    # eldest baseline would pick heir; youngest picks younger
    holding = dict(bag["kin"]["holdings"]["terr-olissippo"])
    holding["territory_id"] = "terr-olissippo"
    holding["player_dynasty_id"] = "pdyn-acb-oli"
    eldest_plan = adj.succession_policy.resolve(
        holding, "kin-oli-chefe-eldest", bag["law_version"], deepcopy(bag["kin"])
    )
    # temporarily resolve under eldest law for contrast
    st_eldest = deepcopy(bag["kin"])
    dc.set_dynasty_succession_law(st_eldest, "pdyn-acb-oli", "eldest_living_child")
    holding_e = dict(holding)
    plan_eldest = adj.succession_policy.resolve(
        holding_e, "kin-oli-chefe-eldest", bag["law_version"], st_eldest
    )
    plan_young = adj.succession_policy.resolve(
        holding, "kin-oli-chefe-eldest", bag["law_version"], bag["kin"]
    )
    assert plan_young["ok"] and plan_eldest["ok"]
    assert plan_young["heir"] == "kin-oli-chefe-younger"
    assert plan_eldest["heir"] == "kin-oli-chefe-heir"
    assert plan_young["heir"] != plan_eldest["heir"]

    # 2–3. force death / apply succession; unique-head still enforced
    applied = adj.SuccessionResolver.apply_succession(bag, plan_young)
    assert applied["ok"]
    assert bag["kin"]["holdings"]["terr-olissippo"]["holder_person_id"] == "kin-oli-chefe-younger"
    assert bag["kin"]["persons"]["kin-oli-chefe-eldest"]["alive"] is False
    assert bag["kin"]["player_dynasties"]["pdyn-acb-oli"]["head_person_id"] == "kin-oli-chefe-younger"
    # cannot also head user dynasty
    assert dc.set_dynasty_head(bag["kin"], "pdyn-user-andre", "kin-oli-chefe-younger")["ok"] is False

    # 4. events carry law_version
    assert any(e["event_type"] == "dynasty_law_set" for e in bag["events"])
    assert any(e["event_type"] == "succession" for e in bag["events"])
    for e in bag["events"]:
        _assert_event_shape(e)
        assert e["law_version"]


def test_scenario_c_trade_craft_provenance_and_mud():
    """trade → craft capability; provenance_chain non-empty; Graphical-MUD stage_snapshot."""
    bag = {
        "castro": castro.new_state(),
        "events": [],
        "law_version": "hearthlaw-1",
    }
    c = bag["castro"]["castros"]["castro-olissippo"]
    lots.ensure_castro_lots(c)
    lots.mint_lot(c, castro_id="castro-olissippo", resource="herd", qty=20)
    # ensure craft works present
    c.setdefault("works", {})
    c["works"]["smith_pit"] = max(1, int(c["works"].get("smith_pit") or 0))
    c["works"]["wood_camp"] = max(1, int(c["works"].get("wood_camp") or 0))

    # 1. exchange / quay_barter moves lots
    r_ex = verbs.execute_verb(
        bag,
        "exchange",
        {"castro_id": "castro-olissippo", "give": "herd", "want": "grain", "amount": 5, "venue": "quay"},
        actor_subject_id="acb-boutius-001",
    )
    assert r_ex["ok"], r_ex
    grain_oid = c["lots"]["grain"]["object_id"]
    herd_oid = c["lots"]["herd"]["object_id"]

    # 2. craft_tick / unlock if wired
    r_craft = verbs.execute_verb(
        bag, "craft_tick", {"castro_id": "castro-olissippo"}, actor_subject_id="acb-boutius-001"
    )
    assert r_craft["ok"], r_craft
    # unlock if enough points; otherwise craft_tick alone is enough for path
    verbs.execute_verb(
        bag, "unlock_craft", {"castro_id": "castro-olissippo"}, actor_subject_id="acb-boutius-001"
    )

    # 3. provenance_chain on resulting lot/object non-empty
    chain_grain = ev.provenance_chain(grain_oid, bag["events"])
    chain_herd = ev.provenance_chain(herd_oid, bag["events"])
    assert chain_grain or chain_herd
    assert any(s["relation"] in (ev.REL_CREATED, ev.REL_TRANSFERRED, ev.REL_USED) for s in (chain_grain + chain_herd))

    for e in bag["events"]:
        _assert_event_shape(e)

    # Graphical-MUD stage_snapshot still works (presence)
    snap = mud.stage_snapshot(
        "quay",
        subject_states=[{"subject_id": "acb-boutius-001", "kind": "acb", "location_id": "quay"}],
    )
    assert snap["engine"] == "gnu_graphical_mud"
    assert snap["location_id"] == "quay"
    assert "exits" in snap and "objects" in snap and "subjects" in snap
    assert snap["subjects"][0]["is_nft"] is False
    assert snap["source_of_truth"] == "server"
    assert mud.engine_info()["engine"] == "gnu_graphical_mud"
    assert ow.action_allowed("move")


def test_apply_paths_emit_season_without_verb_double():
    """Season apply emits once via adjudicator; verb path reuses event."""
    bag = {"bandua": council.new_season_bag(), "events": [], "law_version": "hearthlaw-1"}
    orders = [
        {"unit_id": "u-oli", "power_id": "lusitani", "verb": "hold", "at": "terr-olissippo"},
    ]
    r = verbs.execute_verb(
        bag, "bandua_resolve_season", {"orders": orders}, actor_subject_id="acb-boutius-001"
    )
    assert r["ok"]
    season_evts = [e for e in bag["events"] if e["event_type"] == "season_resolved"]
    assert len(season_evts) == 1
    _assert_event_shape(season_evts[0])


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
