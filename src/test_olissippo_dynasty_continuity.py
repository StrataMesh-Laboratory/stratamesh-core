#!/usr/bin/env python3
"""Gens continuity: elective succession, inherit edges, absentee/steward, extinction."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_dynasty_clock as dc  # noqa: E402
import olissippo_kin as kin  # noqa: E402


def _hall_gens(st):
    """Register Olissippo hall as player gens with elective-ready members."""
    r = dc.ensure_player_dynasty(
        st,
        "gens-oli-chefe",
        owner_subject_id="acb-camala-001",
        owner_kind="acb",
        succession_law="elective",
        gens_id="gens-oli-chefe",
        stirps_id="stirps-oli-chefe",
        populus_id="populus-olissippo",
    )
    assert r["ok"]
    assert dc.set_dynasty_head(st, "gens-oli-chefe", "kin-oli-chefe-eldest")["ok"]
    # younger sibling for elective choice
    st["persons"]["kin-oli-chefe-younger"] = {
        "person_id": "kin-oli-chefe-younger",
        "stirps_id": "stirps-oli-chefe",
        "gens_id": "stirps-oli-chefe",
        "populus_id": "populus-olissippo",
        "display_name": "Younger of the hall",
        "generation": 1,
        "alive": True,
        "parent_ids": ["kin-oli-chefe-eldest"],
        "age_months": 20 * 12,
    }
    return st


def test_nomenclature_and_phase():
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert w["phase"].get("9a_dynasty_continuity")
    assert w.get("playable_unit") == "gens"
    assert w["semantic_map"]["confederation"] == "lusitani"
    nom = (ROOT / "docs/LUSITANIA-NOMENCLATURE.md").read_text()
    assert "gens" in nom and "populus" in nom and "Lusitani" in nom
    assert "Bandua" in nom and "castro" in nom
    kin_c = json.loads((ROOT / "contracts/mud/olissippo-kin-dynasty.json").read_text())
    assert kin_c["confederation"] == "lusitani"
    assert kin_c["stirps_seed"][0].get("gens_id")
    assert kin_c["stirps_seed"][0].get("populus_id")


def test_elective_vote_to_heir():
    st = _hall_gens(kin.new_state())
    # votes: heir gets 1, younger gets 2 → younger wins plurality
    assert dc.cast_succession_vote(st, "gens-oli-chefe", "kin-oli-chefe-eldest", "kin-oli-chefe-heir")["ok"]
    assert dc.cast_succession_vote(st, "gens-oli-chefe", "kin-oli-chefe-heir", "kin-oli-chefe-younger")["ok"]
    assert dc.cast_succession_vote(st, "gens-oli-chefe", "kin-oli-chefe-younger", "kin-oli-chefe-younger")["ok"]
    resolved = dc.resolve_elective(st, "gens-oli-chefe")
    assert resolved["ok"] and resolved["heir"] == "kin-oli-chefe-younger"
    assert resolved["reason"] == "elective_plurality"
    # kill head → continue gens
    st["persons"]["kin-oli-chefe-eldest"]["alive"] = False
    cont = dc.continue_gens_after_head_death(st, "gens-oli-chefe")
    assert cont["ok"] and cont["heir"] == "kin-oli-chefe-younger"
    assert st["player_dynasties"]["gens-oli-chefe"]["head_person_id"] == "kin-oli-chefe-younger"


def test_elective_tie_eldest():
    st = _hall_gens(kin.new_state())
    # one vote each for heir (older) and younger → tie → eldest among tied = heir
    assert dc.cast_succession_vote(st, "gens-oli-chefe", "kin-oli-chefe-eldest", "kin-oli-chefe-heir")["ok"]
    assert dc.cast_succession_vote(st, "gens-oli-chefe", "kin-oli-chefe-younger", "kin-oli-chefe-younger")["ok"]
    resolved = dc.resolve_elective(st, "gens-oli-chefe")
    assert resolved["ok"]
    assert resolved["heir"] == "kin-oli-chefe-heir"
    assert "tie" in resolved["reason"]


def test_enemy_inherited_on_succession():
    st = kin.new_state()
    dc.ensure_player_dynasty(
        st, "gens-oli-chefe", owner_subject_id="acb-camala-001", owner_kind="acb",
        stirps_id="stirps-oli-chefe", populus_id="populus-olissippo",
    )
    dc.set_dynasty_head(st, "gens-oli-chefe", "kin-oli-chefe-eldest")
    assert dc.add_enemy(st, "kin-oli-chefe-eldest", "kin-vetton-herd")["ok"]
    assert dc.add_obligation(st, "kin-oli-chefe-eldest", "kin-oli-smith", reason="tribute_debt")["ok"]
    st["persons"]["kin-oli-chefe-eldest"]["alive"] = False
    st["holdings"]["terr-olissippo"]["player_dynasty_id"] = "gens-oli-chefe"
    plan = dc.resolve_succession(st, "terr-olissippo", law="eldest_living_child", dynasty_id="gens-oli-chefe")
    assert plan["ok"] and plan["heir"] == "kin-oli-chefe-heir"
    applied = dc.apply_succession(st, plan)
    assert applied["ok"]
    inherited = applied["inherited_edges"]
    assert inherited["count"] >= 1
    kinds = {(e["kind"], e["a"], e["b"]) for e in inherited["copied"]}
    assert any(k[0] == "enemy_of" and k[1] == "kin-oli-chefe-heir" for k in kinds)
    assert any(k[0] == "owes_obligation_to" and k[1] == "kin-oli-chefe-heir" for k in kinds)
    # oath_kin not invented as person-level inherit
    assert not any(e.get("kind") == "oath_kin" and e.get("reason") == "inheritance" for e in st["edges"])


def test_absentee_steward_may_act():
    st = kin.new_state()
    dc.ensure_player_dynasty(
        st, "gens-oli-chefe", owner_subject_id="acb-camala-001", owner_kind="acb",
        stirps_id="stirps-oli-chefe",
    )
    dc.set_dynasty_head(st, "gens-oli-chefe", "kin-oli-chefe-eldest")
    # steward = heir
    r = dc.declare_absentee(st, "gens-oli-chefe", "kin-oli-chefe-heir")
    assert r["ok"]
    assert st["player_dynasties"]["gens-oli-chefe"]["absentee"] is True
    gate = dc.steward_may_act(st, "gens-oli-chefe", "kin-oli-chefe-heir")
    assert gate["may_act"] is True and gate["role"] == "steward"
    # outsider cannot
    assert dc.steward_may_act(st, "gens-oli-chefe", "kin-vetton-herd")["may_act"] is False
    # head still ages under advance
    before = st["persons"]["kin-oli-chefe-eldest"]["age_months"]
    tick = dc.advance_game_month(st, 1)
    assert tick["ok"]
    assert st["persons"]["kin-oli-chefe-eldest"]["age_months"] == before + 1
    # steward is not automatic heir on death
    st["persons"]["kin-oli-chefe-eldest"]["age_months"] = 70 * 12 - 1
    # add younger so eldest-child law picks heir (not only steward coincidence — steward IS heir under eldest)
    # switch law to designated pointing at smith to prove steward != auto heir
    dc.set_dynasty_succession_law(st, "gens-oli-chefe", "designated_heir")
    st["persons"]["kin-oli-chefe-eldest"]["designated_heir_id"] = "kin-oli-chefe-heir"
    # actually prove: steward remains steward field, succession uses law
    tick2 = dc.advance_game_month(st, 1, max_age_months=70 * 12)
    assert "kin-oli-chefe-eldest" in tick2["deaths"]
    assert st["player_dynasties"]["gens-oli-chefe"]["head_person_id"] == "kin-oli-chefe-heir"
    assert st["player_dynasties"]["gens-oli-chefe"].get("steward_person_id") == "kin-oli-chefe-heir"
    assert dc.return_from_absentee(st, "gens-oli-chefe")["ok"]
    assert st["player_dynasties"]["gens-oli-chefe"]["absentee"] is False


def test_extinction_still_game_over_without_heir():
    st = kin.new_state()
    dc.ensure_player_dynasty(st, "gens-lonely", owner_subject_id="acb-boutius-001", owner_kind="acb")
    lonely = "kin-oli-smith"
    st["persons"][lonely]["age_months"] = 70 * 12 - 1
    st["persons"][lonely]["parent_ids"] = []
    for pid, pers in list(st["persons"].items()):
        if lonely in (pers.get("parent_ids") or []):
            pers["parent_ids"] = [p for p in pers["parent_ids"] if p != lonely]
    assert dc.set_dynasty_head(st, "gens-lonely", lonely)["ok"]
    r = dc.advance_game_month(st, 1, max_age_months=70 * 12)
    assert lonely in r["deaths"]
    assert "gens-lonely" in r.get("game_over_gentes", []) or "gens-lonely" in r.get("game_over_dynasties", [])
    assert st["player_dynasties"]["gens-lonely"].get("extinct") is True


def test_semantic_map_docs():
    doc = (ROOT / "docs/LUSITANIA-DYNASTY-PLAYABLE-UNIT.md").read_text()
    assert "playable unit = gens" in doc.lower() or "Playable unit = gens" in doc
    assert "populus" in doc.lower() and "Lusitani" in doc
    assert "elective" in doc.lower() and "absentee" in doc.lower()
    html = (ROOT / "frontend/lusitania.html").read_text()
    assert "gens" in html and "populus" in html and "Lusitani" in html
    assert "canonical" in html and "sandbox.calhegasmorais.pt/lusitania" in html
    assert "LUSITANIA-NOMENCLATURE" in html


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
