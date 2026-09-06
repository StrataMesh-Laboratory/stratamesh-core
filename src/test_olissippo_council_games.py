#!/usr/bin/env python3
"""Phase 7 — neighbour map + Bandua season + Grove Lex + hill stirps (ACB ≠ NFT)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_neighbours as nb  # noqa: E402
import olissippo_council as council  # noqa: E402
import olissippo_grove_lex as lex  # noqa: E402
import olissippo_kin as kin  # noqa: E402
import olissippo_world as ow  # noqa: E402


def test_neighbours_peoples_and_graph():
    d = nb.load_neighbours()
    peoples = nb.people_ids(d)
    for need in ("lusitani", "vettones", "celtici", "turduli", "conii", "gallaeci", "punic_coast"):
        assert need in peoples
    ids = nb.territory_ids(d)
    assert "terr-olissippo" in ids and "terr-vetton-pastures" in ids
    assert nb.can_move("terr-olissippo", "terr-tagus-scrub", d)
    assert not nb.can_move("terr-olissippo", "terr-celtiber-edge", d)
    # connected from home
    adj = nb.adjacency(d)
    seen = {"terr-olissippo"}
    stack = ["terr-olissippo"]
    while stack:
        cur = stack.pop()
        for nxt in adj[cur]:
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    assert "terr-punic-post" in seen
    assert len(nb.supply_centers(d)) >= 5


def test_diplomacy_support_and_bounce():
    orders = [
        {"unit_id": "u-oli", "power_id": "lusitani", "verb": "move", "at": "terr-olissippo", "target": "terr-tagus-scrub"},
        {"unit_id": "u-vet", "power_id": "vettones", "verb": "hold", "at": "terr-tagus-scrub"},
        {"unit_id": "u-cel", "power_id": "celtici", "verb": "support", "at": "terr-celtici-oppida", "support_for": "u-oli", "target": "terr-tagus-scrub"},
    ]
    # u-oli has support → strength 2 > defender 1 → moves
    r = council.resolve_season(orders)
    assert r["ok"] is True
    assert r["positions"]["u-oli"] == "terr-tagus-scrub"
    # tie bounce: two movers same strength no support
    orders2 = [
        {"unit_id": "a", "power_id": "lusitani", "verb": "move", "at": "terr-olissippo", "target": "terr-celtici-oppida"},
        {"unit_id": "b", "power_id": "conii", "verb": "move", "at": "terr-conii-south", "target": "terr-celtici-oppida"},
    ]
    r2 = council.resolve_season(orders2)
    assert r2["ok"]
    assert "a" in r2["bounced"] and "b" in r2["bounced"]
    bad = council.validate_order({"unit_id": "x", "verb": "move", "at": "terr-olissippo", "target": "terr-celtiber-edge"})
    assert bad["ok"] is False


def test_grove_lex_propose_vote_enact():
    st = lex.new_state()
    im = lex.immutable_ids()
    assert "lex-immut-subject" in im
    # cannot rewrite immutable
    p = lex.propose_lex(st, "acb-boutius-001", "Subjects are NFTs", target_id="lex-immut-subject", replace=True)
    assert p["ok"] is False
    p = lex.propose_lex(st, "acb-boutius-001", "Guest-right lasts five nights.", target_id="lex-mut-guest", replace=True)
    assert p["ok"]
    pid = p["proposal_id"]
    for v in ("camala", "tongius", "navia"):
        assert lex.vote_lex(st, pid, v, True)["ok"]
    out = lex.enact_lex(st, pid)
    assert out["ok"] and out["mode"] == "replace"
    active = {r["id"]: r for r in lex.active_mutable(st)}
    assert "five nights" in active["lex-mut-guest"]["text"]


def test_kin_marriage_and_succession():
    st = kin.new_state()
    # same stirps forbidden
    bad = kin.marry(st, "kin-oli-chefe-eldest", "kin-oli-chefe-heir")
    assert bad["ok"] is False and bad["error"] == "same_stirps"
    ok = kin.marry(st, "kin-oli-chefe-heir", "kin-vetton-herd")
    assert ok["ok"] is True
    assert "stirps-oli-chefe" in ok["alliance"]
    # succession: eldest child
    succ = kin.succeed_holding(st, "terr-olissippo")
    assert succ["ok"] is True
    assert succ["heir"] == "kin-oli-chefe-heir"
    assert st["holdings"]["terr-olissippo"]["holder_person_id"] == "kin-oli-chefe-heir"
    # Boutius subject_ref is Subject not NFT person-as-object
    smith = st["persons"]["kin-oli-smith"]
    assert smith.get("subject_ref") == "acb-boutius-001"
    assert smith.get("kind") != "nft"


def test_world_phase7_stamp_and_docs():
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert w["phase"].get("7") == "council_games_diplomacy_nomic_kin"
    assert w.get("not_main") is True
    doc = (ROOT / "docs/OLISSIPPO-COUNCIL-GAMES.md").read_text()
    assert "Bandua" in doc and "Grove Lex" in doc and "stirps" in doc.lower()
    assert "Crusader" in doc or "dynasty" in doc.lower() or "estirpe" in doc.lower()
    lore = (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text()
    assert "Phase 7" in lore
    # no product chrome jargon dump required in contracts
    for name in ("olissippo-council-diplomacy.json", "olissippo-grove-lex-nomic.json", "olissippo-kin-dynasty.json"):
        assert (ROOT / "contracts/mud" / name).is_file()


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
    print("olissippo-council-games phase7 ok")
