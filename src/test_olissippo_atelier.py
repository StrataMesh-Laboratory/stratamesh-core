#!/usr/bin/env python3
"""Phase 6 Olissippo Atelier view — lore stage, ACB ≠ NFT, not main."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FE = ROOT / "frontend"


def test_files_exist():
    assert (FE / "olissippo.html").is_file()
    assert (FE / "olissippo-stage.js").is_file()
    assert (FE / "olissippo-world.json").is_file()
    assert (FE / "olissippo-runtime.json").is_file()


def test_snapshot_not_main_and_people_are_subjects():
    snap = json.loads((FE / "olissippo-world.json").read_text())
    assert snap.get("not_main") is True
    assert snap.get("hosts_sandboxes") is False
    assert snap.get("same_mechanics_as_main") is True
    assert snap.get("realm_class") == "lore"
    assert snap.get("realm") == "lore-olissippo-lusitanian"
    assert len(snap.get("locations") or []) >= 13
    assert len(snap.get("people") or []) == 5
    for p in snap["people"]:
        assert p.get("kind") == "person"
        assert p.get("subject_ref", "").startswith("acb-")
        # chrome-facing name must not look like object_id
        assert not str(p["name"]).startswith("obj-")
        assert not str(p["name"]).startswith("acb-")


def test_html_chrome_has_no_object_id_jargon():
    html = (FE / "olissippo.html").read_text()
    # visible chrome labels
    assert "object_id" not in html
    assert "subject_id" not in html
    assert "Aldeia de Olissippo" in html or "Olissippo" in html
    assert ("não principal" in html or "não CMN principal" in html or "not main" in html.lower() or "not cmn main" in html.lower())
    assert "Pessoas aqui" in html
    # must not call people NFTs in chrome
    assert "NFT" not in html.split("aside")[0]  # header free of NFT pitch


def test_stage_js_acb_not_nft():
    js = (FE / "olissippo-stage.js").read_text()
    assert "NOT main" in js or "not_main" in js
    assert "People ≠ NFT" in js or "Pessoas ≠ objectos NFT" in js
    assert "object_id" not in js or "no object_id" in js.lower()
    # move only along edges
    assert "exitsFrom" in js


def test_redirects_olissippo():
    """Pages clean-URLs olissippo.html at /olissippo; a 200 rewrite fights the 308 and loops."""
    rd = (FE / "_redirects").read_text()
    assert "olissippo.html" in rd  # documented in comments
    # must NOT have the loop-causing rewrite
    for line in rd.splitlines():
        s = line.strip()
        if s.startswith("#") or not s:
            continue
        assert not s.startswith("/olissippo "), f"looping rewrite forbidden: {s}"
        assert not s.startswith("/olissippo/"), f"looping rewrite forbidden: {s}"
        assert "/olissippo.html 200" not in s


def test_world_phase_stamp():
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert (w.get("phase") or {}).get("6") == "atelier_view"


def test_lore_phase6_pointer():
    lore = (ROOT / "docs/LORE-VILLAGE-ACB-MUD.md").read_text()
    assert "Phase 6" in lore
    assert "olissippo.html" in lore or "Atelier" in lore
    assert "ACB ≠ NFT" in lore


def test_runtime_is_live_ticks_not_mock():
    rt = json.loads((FE / "olissippo-runtime.json").read_text())
    assert rt["not_main"] is True
    assert rt["hosts_sandboxes"] is False
    assert "tick" in (rt.get("generated_by") or "").lower() or "gen-olissippo" in (rt.get("generated_by") or "")
    assert len(rt["people"]) == 5
    for person in rt["people"]:
        assert person["subject_ref"].startswith("acb-")
        assert person["is_nft"] is False
        assert person.get("location_id")


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
    print("olissippo-atelier phase6 ok")


