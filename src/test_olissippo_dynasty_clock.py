#!/usr/bin/env python3
"""1 real day = 1 game month; succession laws (CK-style dynasty progression)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_dynasty_clock as dc  # noqa: E402
import olissippo_kin as kin  # noqa: E402


def test_clock_stamp():
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert w["clock"]["real_day_equals_game_months"] == 1
    assert w["clock"]["dynasty_tick"] is True
    assert dc.real_day_to_game_months() == 1


def test_twelve_months_ages_one_year():
    st = kin.new_state()
    before = st["persons"]["kin-oli-chefe-heir"]["age_months"]
    r = dc.advance_game_month(st, 12)
    assert r["ok"]
    assert st["persons"]["kin-oli-chefe-heir"]["age_months"] == before + 12
    assert st["game_month"] == 12


def test_succession_on_max_age_death():
    st = kin.new_state()
    # force elder near death
    st["persons"]["kin-oli-chefe-eldest"]["age_months"] = 70 * 12 - 1
    r = dc.advance_game_month(st, 1, max_age_months=70 * 12)
    assert r["ok"]
    assert "kin-oli-chefe-eldest" in r["deaths"]
    assert st["persons"]["kin-oli-chefe-eldest"]["alive"] is False
    assert st["holdings"]["terr-olissippo"]["holder_person_id"] == "kin-oli-chefe-heir"
    assert any(s["heir"] == "kin-oli-chefe-heir" for s in r["successions"])


def test_youngest_law_ranks_differently():
    st = kin.new_state()
    st["persons"]["kin-oli-chefe-heir"]["age_months"] = 28 * 12
    st["persons"]["kin-oli-chefe-younger"] = {
        "person_id": "kin-oli-chefe-younger",
        "stirps_id": "stirps-oli-chefe",
        "display_name": "Younger",
        "generation": 1,
        "alive": True,
        "parent_ids": ["kin-oli-chefe-eldest"],
        "age_months": 20 * 12,
    }
    eldest = dc.rank_heirs(st, "kin-oli-chefe-eldest", "eldest_living_child")
    youngest = dc.rank_heirs(st, "kin-oli-chefe-eldest", "youngest_living_child")
    assert eldest[0] == "kin-oli-chefe-heir"
    assert youngest[0] == "kin-oli-chefe-younger"


def test_architecture_mentions_month_clock():
    arch = (ROOT / "docs/OLISSIPPO-ENGINE-ARCHITECTURE.md").read_text()
    assert "real day" in arch.lower() or "game month" in arch.lower() or "1 real day" in arch



def test_unique_dynasty_head_across_two_players():
    """Two player dynasties (ACB + user) cannot share the same successor-as-head."""
    st = kin.new_state()
    assert dc.ensure_player_dynasty(st, "dyn-acb-boutius", owner_subject_id="acb-boutius-001", owner_kind="acb")["ok"]
    assert dc.ensure_player_dynasty(st, "dyn-user-andre", owner_subject_id="user-andre-001", owner_kind="user")["ok"]
    assert dc.set_dynasty_head(st, "dyn-acb-boutius", "kin-oli-chefe-heir")["ok"]
    bad = dc.set_dynasty_head(st, "dyn-user-andre", "kin-oli-chefe-heir")
    assert bad["ok"] is False and bad["error"] == "shared_successor_forbidden"
    # different heir ok
    assert dc.set_dynasty_head(st, "dyn-user-andre", "kin-vetton-herd")["ok"]


def test_per_dynasty_nomic_succession_law():
    st = kin.new_state()
    dc.ensure_player_dynasty(st, "dyn-acb-boutius", owner_subject_id="acb-boutius-001", owner_kind="acb")
    assert dc.dynasty_law(st, "dyn-acb-boutius") == "eldest_living_child"
    r = dc.set_dynasty_succession_law(st, "dyn-acb-boutius", "youngest_living_child")
    assert r["ok"] and r["to"] == "youngest_living_child"
    assert dc.dynasty_law(st, "dyn-acb-boutius") == "youngest_living_child"


def test_acb_en_sca_pt_label():
    st = kin.new_state()
    dc.ensure_player_dynasty(st, "dyn-x", owner_subject_id="acb-boutius-001", owner_kind="acb")
    assert st["player_dynasties"]["dyn-x"]["owner_label_pt"] == "SCA"
    assert st["player_dynasties"]["dyn-x"]["owner_kind"] == "acb"


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
