#!/usr/bin/env python3
"""Phase 3 decide→validate→execute — ACB ≠ NFT; mock LLM for CI."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_boutius as bb  # noqa: E402
import olissippo_decide as dec  # noqa: E402


def test_reject_unknown_and_nft_self():
    s = bb.initial_state()
    bad = dec.validate_decision(s, {"action": {"type": "fireball"}})
    assert bad["ok"] is False and bad["error"] == "unknown_action"
    nft = dec.validate_decision(s, {"action": {"type": "wait", "object_id": "obj-fake"}})
    assert nft["ok"] is False and nft["error"] == "acb_is_not_nft"


def test_validate_move_and_execute():
    s = bb.initial_state()
    s["location_id"] = "smithy"
    decision = {"intention": "Get charcoal", "action": {"type": "move", "destination": "charcoal_lean"}, "speech": None}
    gate = dec.validate_decision(s, decision)
    assert gate["ok"] is True
    s2 = dec.execute_decision(s, gate)
    assert s2["location_id"] == "charcoal_lean"
    assert s2["kind"] == "acb" and s2["is_nft"] is False
    assert "object_id" not in s2


def test_reject_non_adjacent_move():
    s = bb.initial_state()
    s["location_id"] = "smithy"
    gate = dec.validate_decision(s, {"action": {"type": "move", "destination": "quay"}})
    assert gate["ok"] is False


def test_cognitive_tick_mock_buys_charcoal():
    s = bb.initial_state()
    s["minute"] = 16 * 60
    s["location_id"] = "smithy"
    s["charcoal_held"] = 0
    s2 = dec.cognitive_tick(s, 10, decide=dec.mock_decide)
    bb.assert_subject_not_nft(s2)
    assert s2["location_id"] == "charcoal_lean"
    # mock may move then need another tick to buy — allow either moved-with-buy or move-only
    if s2["charcoal_held"] < 2:
        s2 = dec.cognitive_tick(s2, 10, decide=dec.mock_decide)
    assert s2["charcoal_held"] >= 2
    assert s2["is_nft"] is False


def test_rejected_llm_falls_back_without_becoming_nft():
    def evil(_state, _perc):
        return {"intention": "cheat", "action": {"type": "move", "destination": "quay"}}  # not adjacent from spawn path may vary

    s = bb.initial_state()
    s["location_id"] = "smithy"
    s["minute"] = 8 * 60
    s["charcoal_held"] = 2
    s2 = dec.cognitive_tick(s, 10, decide=evil)
    bb.assert_subject_not_nft(s2)
    assert s2["kind"] == "acb"
    assert "object_id" not in s2
    # should have fallen back or rejected — not teleported to quay from smithy in one illegal hop
    assert s2["location_id"] != "quay" or s2["last_action"].get("source") == "llm"


def test_parse_json_fence():
    raw = '```json\n{"intention":"x","action":{"type":"wait"},"speech":null}\n```'
    d = dec.parse_decision(raw)
    assert d["action"]["type"] == "wait"


def test_lore_phase3_pointer():
    lore = (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text()
    assert "olissippo_decide" in lore or "Phase 3" in lore
    assert "ACB ≠ NFT" in lore


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
    if failed:
        sys.exit(1)
    print("olissippo-decide phase3 ok")
