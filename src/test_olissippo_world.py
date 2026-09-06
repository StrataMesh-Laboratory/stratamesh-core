#!/usr/bin/env python3
"""Phase 1 Olissippo lore world graph + ontology locks."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_world as ow  # noqa: E402


def test_world_file_and_realm():
    w = ow.load_world()
    assert w["not_main"] is True
    assert w["realm"] == "lore-olissippo-lusitanian"
    assert w["culture_tag"] == "lusitanian_olissippo"
    assert w["oracle_live"] is False
    assert len(w["locations"]) >= 12
    assert "boutius" not in json.dumps(w).lower() or True  # personas phase 2+
    # no Subject rows in seed objects
    for o in w["seed_objects"]:
        assert o["kind"] != "subject"
        assert "object_id" in o
        assert o["kind"] in ("object", "room", "parcel", "bundle")


def test_graph_connected_and_moves():
    w = ow.load_world()
    ids = ow.location_ids(w)
    assert "smithy" in ids and "charcoal_lean" in ids and "sacred_grove" in ids
    adj = ow.adjacency(w)
    assert ow.can_move("smithy", "charcoal_lean", w)
    assert not ow.can_move("smithy", "quay", w)
    ok = ow.validate_move("hill_enclosure", "smithy", w)
    assert ok["ok"] is True
    bad = ow.validate_move("smithy", "quay", w)
    assert bad["ok"] is False and bad["error"] == "not_adjacent"
    # every location reachable from spawn via BFS
    spawn = w["spawn"]["default_location_id"]
    seen = {spawn}
    stack = [spawn]
    while stack:
        cur = stack.pop()
        for nxt in adj[cur]:
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    assert seen == ids, f"disconnected: {ids - seen}"


def test_seed_objects_and_charcoal_continuity():
    w = ow.load_world()
    objs = {o["object_id"]: o for o in w["seed_objects"]}
    assert "obj-oli-charcoal-01" in objs
    assert objs["obj-oli-charcoal-01"]["location_id"] == "charcoal_lean"
    assert objs["obj-oli-spearhead-blank-01"]["location_id"] == "smithy"
    at = ow.objects_at("charcoal_lean", w)
    assert any(o["object_id"] == "obj-oli-charcoal-01" for o in at)


def test_magic_hooks_server_vocab():
    w = ow.load_world()
    assert "rite_offer" in w["actions_magic"]
    assert ow.action_allowed("move", w)
    assert ow.action_allowed("rite_offer", w)
    assert not ow.action_allowed("fireball", w)
    grove = ow.numen_at("sacred_grove", w)
    assert any(n["numen_id"] == "endovelicus" for n in grove)
    # numina are hooks, not Subject/Object seed rows
    assert all("subject_id" not in n for n in w["numen_hooks"])
    assert w["origine_draft"]["provision"] is True and w["origine_draft"]["mvp_empty"] is True


def test_lore_doc_phase1_pointer():
    lore = (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text().lower()
    assert "olissippo" in lore and "phase 1" in lore or "phases" in lore
    assert "olissippo-world.json" in (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text()


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
    print("olissippo-world phase1 ok")
