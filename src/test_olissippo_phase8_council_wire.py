#!/usr/bin/env python3
"""Phase 8 — council/castro wired into decide; STRATA object stamps; lore≡main stakes."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_boutius as bb  # noqa: E402
import olissippo_council_runtime as cr  # noqa: E402
import olissippo_decide as dec  # noqa: E402
import olissippo_world as ow  # noqa: E402


def test_actions_council_allowed():
    assert ow.action_allowed("castro_quay_barter")
    assert ow.action_allowed("bandua_resolve_season")
    assert ow.action_allowed("claim_press")


def test_castro_object_id_stamps():
    s = bb.new_state() if hasattr(bb, "new_state") else {
        "subject_id": "acb-boutius-001",
        "kind": "acb",
        "is_nft": False,
        "location_id": "market",
        "charcoal_held": 2,
        "minute": 0,
        "day": 1,
    }
    # boutius state helper
    try:
        from olissippo_boutius import initial_state
        s = initial_state()
    except Exception:
        pass
    s["subject_id"] = "acb-boutius-001"
    s["kind"] = "acb"
    s["is_nft"] = False
    s["location_id"] = "market"
    bag = cr.ensure_bag(s)
    c = bag["castro"]["castros"]["castro-olissippo"]
    assert c["object_id"].startswith("obj-oli-")
    assert c["is_nft"] is True
    assert c["nft_family"] == "STRATA"
    assert "herd" in c["lot_object_ids"]


def test_decide_quay_barter_wire():
    try:
        from olissippo_boutius import initial_state
        s = initial_state()
    except Exception:
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
    s["subject_id"] = "acb-boutius-001"
    s["location_id"] = "market"
    s["is_nft"] = False
    s.pop("object_id", None)
    cr.ensure_bag(s)
    # give resources
    s["council"]["castro"]["castros"]["castro-olissippo"]["resources"]["herd"] = 40
    decision = {"action": {"type": "castro_quay_barter", "give": "herd", "want": "grain", "amount": 5}}
    gate = dec.validate_decision(s, decision)
    assert gate["ok"] is True, gate
    s2 = dec.execute_decision(s, gate)
    assert s2["last_action"]["ok"] is True
    assert s2["last_action"].get("strata_stakes") is True
    assert s2["is_nft"] is False
    assert "object_id" not in s2
    # lots moved
    assert s2["council"]["castro"]["castros"]["castro-olissippo"]["resources"]["herd"] == 35


def test_plant_assigns_strata_object_id():
    try:
        from olissippo_boutius import initial_state
        s = initial_state()
    except Exception:
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
    s["subject_id"] = "acb-boutius-001"
    s["is_nft"] = False
    bag = cr.ensure_bag(s)
    c = bag["castro"]["castros"]["castro-olissippo"]
    c["resources"] = {"herd": 100, "grain": 100, "timber": 100, "ore": 50}
    c["population"] = 80
    gate = dec.validate_decision(s, {
        "action": {
            "type": "castro_plant",
            "territory_id": "terr-tagus-scrub",
            "new_castro_id": "castro-tagus-p8",
        }
    })
    assert gate["ok"], gate
    s2 = dec.execute_decision(s, gate)
    neo = s2["council"]["castro"]["castros"]["castro-tagus-p8"]
    assert neo["object_id"] == "obj-oli-castro-tagus-p8"
    assert neo["is_nft"] is True
    assert neo["nft_family"] == "STRATA"


def test_phase8_stamp_and_docs():
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert w["phase"].get("8") == "council_castro_decide_wire_strata_objects"
    assert "castro_quay_barter" in w["actions_council"]
    doc = (ROOT / "docs/OLISSIPPO-COUNCIL-GAMES.md").read_text()
    assert "Phase 8" in doc
    assert w["council_games"]["ontology"]["lore_economics_equivalent_to_main"] is True


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
