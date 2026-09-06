#!/usr/bin/env python3
"""Phase 5 five personas — all ACB Subjects, never NFT."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_boutius as bb  # noqa: E402
import olissippo_personas as op  # noqa: E402
import olissippo_world as ow  # noqa: E402


EXPECTED = {
    "boutius": "acb-oli-boutius-001",
    "camala": "acb-oli-camala-001",
    "apana": "acb-oli-apana-001",
    "tongius": "acb-oli-tongius-001",
    "navia": "acb-oli-navia-001",
}


def test_index_has_five():
    idx = op.load_index()
    assert len(idx["personas"]) == 5
    slugs = {p["slug"] for p in idx["personas"]}
    assert slugs == set(EXPECTED)


def test_each_persona_is_acb_not_nft():
    locs = {loc["id"] for loc in ow.load_world()["locations"]}
    for slug, sid in EXPECTED.items():
        p = op.load_persona(slug)
        assert p["subject_id"] == sid
        assert p["kind"] == "acb"
        assert "object_id" not in p
        assert p["home_location"] in locs
        st = op.initial_state(p)
        bb.assert_subject_not_nft(st)
        assert st["is_nft"] is False and st["is_object"] is False


def test_routines_move_without_becoming_nft():
    trails = op.tick_all(minutes=20, days_hours=4.0)
    assert len(trails) == 5
    for sid, trail in trails.items():
        assert sid.startswith("acb-")
        last = trail[-1]
        bb.assert_subject_not_nft(last)
        assert "object_id" not in last
        # some location change or activity log across 4h
        locs = {t["location_id"] for t in trail}
        assert len(locs) >= 1
        assert any(t.get("last_action") for t in trail[1:])


def test_boutius_still_matches_phase2_file():
    p = op.load_persona("boutius")
    raw = json.loads((ROOT / "contracts/mud/olissippo-persona-boutius.json").read_text())
    assert p["subject_id"] == raw["subject_id"] == "acb-oli-boutius-001"


def test_apana_fetches_toward_charcoal():
    p = op.load_persona("apana")
    s = op.initial_state(p)
    s["minute"] = 13 * 60
    s["location_id"] = "smithy"
    s2 = op.tick(s, 10)
    # should move toward charcoal_lean
    assert s2["location_id"] in ("charcoal_lean", "smithy", "apprentice_yard", "guest_house", "market", "hill_enclosure")
    path = bb._path("smithy", "charcoal_lean")
    assert path  # adjacency exists
    # one hop along path
    if s2["location_id"] != "charcoal_lean":
        assert s2["location_id"] == path[0]


def test_lore_phase5_pointer():
    lore = (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text()
    assert "Phase 5" in lore
    assert "Camala" in lore and "Navia" in lore
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
    print("olissippo-personas phase5 ok")
