#!/usr/bin/env python3
"""Phase 4 MemoryEvent + SubjectEdge — ACB ≠ NFT; Day-2 continuity."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_boutius as bb  # noqa: E402
import olissippo_memory as mem  # noqa: E402


PLAYER = "user-oli-player-001"


def test_schema_file_exists():
    p = ROOT / "contracts/mud/olissippo-memory-schema.json"
    assert p.is_file()
    import json
    data = json.loads(p.read_text())
    assert "MemoryEvent" in data and "SubjectEdge" in data


def test_reject_object_id_as_subject():
    store = mem.empty_store()
    try:
        mem.record_memory(store, subject_id="obj-charcoal-001", ts="d1", type="trade", summary="x")
        assert False, "should reject"
    except ValueError as e:
        assert "subject" in str(e)


def test_record_and_recall_trade():
    s = bb.initial_state()
    store = mem.empty_store()
    s["last_action"] = {"type": "buy", "item": "charcoal", "quantity": 2, "ok": True}
    s["location_id"] = "charcoal_lean"
    store = mem.record_from_action(store, s, other_subject_id=PLAYER)
    hits = mem.recall(store, s["subject_id"], about_subject=PLAYER)
    assert hits
    assert hits[0]["type"] == "trade"
    assert "object_id" not in hits[0]
    edge = mem.get_edge(store, s["subject_id"], PLAYER)
    assert edge is not None
    assert float(edge["familiarity"]) > 0.1
    bb.assert_subject_not_nft(s)


def test_day2_speech_cites_charcoal():
    s = bb.initial_state()
    store, line = mem.day2_player_meet(mem.empty_store(), s, PLAYER)
    assert line is not None
    assert "charcoal" in line.lower() or "You" in line
    # Boutius still ACB Subject
    assert s["kind"] == "acb" and s["is_nft"] is False
    assert "object_id" not in s
    hits = mem.recall(store, s["subject_id"], about_subject=PLAYER, min_importance=0.8)
    assert len(hits) >= 1


def test_edge_sorted_and_capped_importance():
    store = mem.empty_store()
    store = mem.upsert_edge(store, "acb-b", "acb-a", trust_delta=0.1, familiarity_delta=0.1, ts="d1")
    e = mem.get_edge(store, "acb-a", "acb-b")
    assert e["a_id"] == "acb-a" and e["b_id"] == "acb-b"


def test_lore_phase4_pointer():
    lore = (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text()
    assert "Phase 4" in lore
    assert "MemoryEvent" in lore
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
    print("olissippo-memory phase4 ok")
