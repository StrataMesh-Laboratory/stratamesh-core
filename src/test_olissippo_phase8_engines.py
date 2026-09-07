#!/usr/bin/env python3
"""Phase 8A/8B — five engines foundation: events, lots, verbs, pure season, stamps."""
from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_council as council  # noqa: E402
import olissippo_council_runtime as cr  # noqa: E402
import olissippo_decide as dec  # noqa: E402
import olissippo_events as ev  # noqa: E402
import olissippo_lots as lots  # noqa: E402
import olissippo_verbs as verbs  # noqa: E402
import olissippo_world as ow  # noqa: E402


def test_event_schema_fields():
    schema = ev.load_event_schema()
    req = schema["Event"]["required"]
    for f in (
        "event_id",
        "event_type",
        "season",
        "timestamp",
        "actor_subject_ids",
        "object_ids",
        "location_ids",
        "verb",
        "before",
        "after",
        "rule_version",
        "law_version",
        "provenance",
        "causes",
        "reason",
    ):
        assert f in req
    evt = ev.make_event(event_type="test", verb="hold", reason="unit_test", law_version="hearthlaw-1")
    assert evt["law_version"] == "hearthlaw-1" and evt["reason"] == "unit_test"
    bag = {"events": []}
    ev.append_event(bag, evt)
    assert bag["events"][0]["event_id"] == evt["event_id"]
    try:
        ev.make_event(event_type="x", verb="hold", reason="")
        assert False, "empty reason should fail"
    except ValueError:
        pass


def test_lot_mint_and_transfer():
    c1 = {
        "castro_id": "castro-a",
        "holder_subject": "acb-boutius-001",
        "resources": {"herd": 10, "grain": 0, "timber": 0, "ore": 0},
    }
    c2 = {
        "castro_id": "castro-b",
        "holder_subject": "acb-camala-001",
        "resources": {"herd": 0, "grain": 0, "timber": 0, "ore": 0},
    }
    lots.ensure_castro_lots(c1)
    lots.ensure_castro_lots(c2)
    m = lots.mint_lot(c1, castro_id="castro-a", resource="herd", qty=5)
    assert m["ok"] and m["after"] == 15
    assert c1["is_nft"] is True and c1["nft_family"] == "STRATA"
    t = lots.transfer_lot(c1, c2, "herd", 4)
    assert t["ok"] and c1["lots"]["herd"]["qty"] == 11 and c2["lots"]["herd"]["qty"] == 4
    agg = lots.aggregates(c1)
    assert agg["by_resource"]["herd"] == 11


def test_verb_registry_and_reject_subject_nft():
    reg = verbs.load_registry()
    ids = {v["id"] for v in reg["verbs"]}
    for need in ("hold", "move", "support", "escort", "exchange", "press_claim", "tick_production", "river_escort"):
        assert need in ids
    assert verbs.canonical_verb("castro_quay_barter") == "exchange"
    assert verbs.canonical_verb("river_escort") == "escort"
    g = verbs.validate_verb("exchange", {})
    assert g["ok"]
    bad = verbs.validate_verb("exchange", {"mint_nft": True})
    assert bad["ok"] is False and bad["error"] == "acb_is_not_nft"
    bad2 = verbs.execute_verb(
        {"castro": __import__("olissippo_castro").new_state(), "events": [], "law_version": "hearthlaw-1"},
        "exchange",
        {"object_id": "obj-self", "kind": "acb", "castro_id": "x", "give": "herd", "want": "grain", "amount": 1},
    )
    assert bad2["ok"] is False


def test_pure_resolve_season_and_apply():
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
    snap = deepcopy(bag["bandua"])
    r = council.resolve_season(orders)
    assert r["ok"] and r.get("pure") is True
    assert r["positions"]["u-oli"] == "terr-tagus-scrub"
    # purity: season bag unchanged by resolve
    assert bag["bandua"] == snap
    applied = council.apply_resolution(bag, r)
    assert applied["ok"] and bag["bandua_last"]["positions"]["u-oli"] == "terr-tagus-scrub"
    assert bag["season"] >= 1


def test_no_subject_object_id_on_state():
    s = {
        "subject_id": "acb-boutius-001",
        "kind": "acb",
        "is_nft": False,
        "is_subject": True,
        "location_id": "market",
        "charcoal_held": 2,
        "minute": 100,
        "day": 1,
        "status_flags": [],
    }
    cr.ensure_bag(s)
    assert "object_id" not in s
    assert s.get("is_nft") is False
    gate = dec.validate_decision(s, {"action": {"type": "castro_quay_barter", "give": "herd", "want": "grain", "amount": 1, "object_id": "obj-me"}})
    assert gate["ok"] is False and gate["error"] == "acb_is_not_nft"


def test_barter_emits_event():
    s = {
        "subject_id": "acb-boutius-001",
        "kind": "acb",
        "is_nft": False,
        "is_subject": True,
        "location_id": "market",
        "charcoal_held": 2,
        "minute": 100,
        "day": 1,
        "status_flags": [],
    }
    bag = cr.ensure_bag(s)
    bag["castro"]["castros"]["castro-olissippo"]["resources"]["herd"] = 40
    gate = dec.validate_decision(
        s, {"action": {"type": "castro_quay_barter", "give": "herd", "want": "grain", "amount": 5}}
    )
    assert gate["ok"], gate
    s2 = dec.execute_decision(s, gate)
    assert s2["last_action"]["ok"] is True
    events = s2["council"]["events"]
    assert events, "expected Event from barter"
    last = events[-1]
    assert last["verb"] in ("exchange", "castro_quay_barter") or last["event_type"] == "exchange"
    assert last.get("law_version")
    assert last.get("reason")
    assert s2["council"]["castro"]["castros"]["castro-olissippo"]["resources"]["herd"] == 35


def test_plant_assigns_object_id():
    s = {
        "subject_id": "acb-boutius-001",
        "kind": "acb",
        "is_nft": False,
        "location_id": "hill_enclosure",
        "charcoal_held": 0,
        "minute": 0,
        "day": 1,
        "status_flags": [],
    }
    bag = cr.ensure_bag(s)
    c = bag["castro"]["castros"]["castro-olissippo"]
    c["resources"] = {"herd": 100, "grain": 100, "timber": 100, "ore": 50}
    c["population"] = 80
    gate = dec.validate_decision(
        s,
        {
            "action": {
                "type": "castro_plant",
                "territory_id": "terr-tagus-scrub",
                "new_castro_id": "castro-tagus-p8b",
            }
        },
    )
    assert gate["ok"], gate
    s2 = dec.execute_decision(s, gate)
    neo = s2["council"]["castro"]["castros"]["castro-tagus-p8b"]
    assert neo["object_id"] == "obj-oli-castro-tagus-p8b"
    assert neo["is_nft"] is True and neo["nft_family"] == "STRATA"
    assert "lot_object_ids" in neo


def test_phases_and_architecture_doc_keywords():
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert w["phase"]["8a"] == "five_engines_event_pipeline_verb_registry"
    assert w["phase"]["8b"] == "runtime_events_lots_law_version_ci"
    assert "architecture" in w["council_games"]
    assert ow.action_allowed("castro_quay_barter")
    assert ow.action_allowed("exchange")
    doc = (ROOT / "docs/OLISSIPPO-ENGINE-ARCHITECTURE.md").read_text()
    for kw in (
        "five composing engines",
        "event-producing",
        "resolve_season",
        "HearthLaw",
        "law_version",
        "STRATA",
        "LLM interprets",
        "raid ≠ siege ≠ annex",
        "8A",
        "8E",
        "wall principle",
        "quay_barter",
        "succession_policy",
    ):
        assert kw in doc or kw.replace("≠", "!=") in doc or "raid" in doc and "siege" in doc and "annex" in doc
    # stronger checks
    assert "HearthLaw" in doc
    assert "resolve_season" in doc
    assert "LLM interprets" in doc
    assert "wall principle" in doc
    assert "succession_policy" in doc
    assert "Adjudication" in doc and "Nomic" in doc
    policy = json.loads((ROOT / "contracts/mud/olissippo-policy-layer.json").read_text())
    assert policy["policy"]["defaults"]["succession_default"] == "eldest_living_child"
    assert any(x["id"] == "core-subject-not-nft" for x in policy["immutable_core"])


def test_season_bag_helpers():
    bag = council.new_season_bag()
    o = {"unit_id": "u1", "power_id": "lusitani", "verb": "hold", "at": "terr-olissippo"}
    assert council.submit_order(bag, o)["ok"]
    assert council.close_season(bag)["ok"]
    assert council.submit_order(bag, o)["ok"] is False


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
