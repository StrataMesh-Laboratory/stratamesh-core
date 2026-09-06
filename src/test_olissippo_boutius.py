#!/usr/bin/env python3
"""Phase 2 Boutius — ACB Subject ≠ NFT; deterministic routine."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_boutius as bb  # noqa: E402
import olissippo_world as ow  # noqa: E402


def test_persona_is_acb_subject_not_object():
    p = bb.load_persona()
    assert p["kind"] == "acb"
    assert p["subject_id"] == "acb-boutius-001"
    assert "object_id" not in p
    world = ow.load_world()
    seeds = world.get("subject_seeds") or []
    assert any(s["subject_id"] == p["subject_id"] and s.get("not_nft") for s in seeds)
    # Boutius must not appear as seed Object
    for o in world["seed_objects"]:
        assert "boutius" not in o["object_id"].lower()
        assert o.get("kind") != "acb"


def test_routine_moves_and_works_without_llm():
    s = bb.initial_state()
    bb.assert_subject_not_nft(s)
    # 08:00 work window
    s["minute"] = 8 * 60
    s["location_id"] = "smithy"
    s["charcoal_held"] = 3
    s2 = bb.tick(s, 10)
    assert s2["kind"] == "acb"
    assert s2["is_nft"] is False
    assert s2["last_action"]["type"] in ("work", "wait", "move")
    if s2["last_action"]["type"] == "work":
        assert s2["spear_progress"] >= 1
        assert s2["charcoal_held"] == 2


def test_path_to_charcoal_lean():
    s = bb.initial_state()
    s["minute"] = 16 * 60  # fetch_charcoal
    s["location_id"] = "smithy"
    s["charcoal_held"] = 0
    # arrive + gather may be same tick
    s = bb.tick(s, 10)
    bb.assert_subject_not_nft(s)
    assert s["location_id"] == "charcoal_lean"
    assert s["charcoal_held"] >= 2
    assert s["kind"] == "acb" and s["is_nft"] is False


def test_day_autonomy_exists_without_player():
    s = bb.initial_state()
    s["minute"] = 7 * 60  # morning — will eat/work/move without a player
    s = bb.run_until(s, ticks=30, minutes_per_tick=10)
    bb.assert_subject_not_nft(s)
    assert len(s["log"]) >= 10
    types = {e["action"]["type"] for e in s["log"] if e.get("action")}
    assert types & {"move", "work", "wait", "eat", "buy", "sleep"}
    # still a Subject — ACB ≠ NFT
    assert s["subject_id"].startswith("acb-")
    assert "object_id" not in s
    assert s["is_nft"] is False and s["is_object"] is False


def test_mud_tables_say_subjects_not_objects():
    data = json.loads((ROOT / "contracts/mud/tables.json").read_text())
    rules = " ".join(data["tables"]["Subject"]["rules"]).lower()
    assert "subjects not objects" in rules or "never" in rules
    lore = (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text().lower()
    raw = (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text()
    assert "acb" in raw.lower()
    assert "ACB ≠ NFT" in raw or "acb ≠ nft" in raw.lower() or "never an Object" in raw.lower()


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
    print("olissippo-boutius phase2 ok")
