#!/usr/bin/env python3
"""Language player pools → microhypervisor selection (CPLP PT-PT vs Intl EN-GB)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_player_pools as pools  # noqa: E402


def test_cplp_countries_resolve_to_cplp_pool():
    for cc in sorted(pools.CPLP_COUNTRY_CODES):
        assert pools.resolve_player_pool(country_code=cc) == "cplp", cc
        assert pools.locale_norm_for_pool("cplp") == "pt-PT"


def test_non_cplp_countries_resolve_to_international():
    for cc in ("US", "GB", "FR", "DE", "ES", "JP", "CN", "IN"):
        assert pools.resolve_player_pool(country_code=cc) == "international", cc
    assert pools.locale_norm_for_pool("international") == "en-GB"


def test_geo_primary_over_accept_language():
    # US geo must stay international even if Accept-Language prefers Portuguese
    assert (
        pools.resolve_player_pool(country_code="US", accept_language="pt-PT,pt;q=0.9")
        == "international"
    )
    # PT geo must stay cplp even if Accept-Language prefers English
    assert (
        pools.resolve_player_pool(country_code="PT", accept_language="en-GB,en;q=0.9")
        == "cplp"
    )
    # Missing geo → international; Accept-Language alone does not promote to CPLP
    assert (
        pools.resolve_player_pool(accept_language="pt-BR,pt;q=0.8")
        == "international"
    )


def test_explicit_pool_override():
    assert (
        pools.resolve_player_pool(country_code="US", explicit_pool="cplp") == "cplp"
    )
    assert (
        pools.resolve_player_pool(country_code="PT", explicit_pool="international")
        == "international"
    )
    assert pools.resolve_player_pool(explicit_pool="intl") == "international"
    assert pools.resolve_player_pool(country_code="BR", explicit_pool="en-gb") == "international"


def test_select_microhypervisor_lusitania():
    cplp = pools.select_microhypervisor_pool(
        "lore-olissippo-lusitanian", country_code="PT"
    )
    assert cplp["player_pool"] == "cplp"
    assert cplp["locale_norm"] == "pt-PT"
    assert cplp["microhypervisor_id"] == "microhv-lusitania-cplp-pt-pt"
    assert cplp["macrohypervisor_id"] == "macrohv-lusitania-olissippo"
    assert cplp["microhypervisor_id"].endswith("cplp-pt-pt")

    intl = pools.select_microhypervisor_pool(
        "lore-olissippo-lusitanian", country_code="US"
    )
    assert intl["player_pool"] == "international"
    assert intl["locale_norm"] == "en-GB"
    assert intl["microhypervisor_id"] == "microhv-lusitania-intl-en-gb"
    assert intl["macrohypervisor_id"] == cplp["macrohypervisor_id"]  # same macro


def test_select_microhypervisor_cmn_main_same_bundle():
    a = pools.select_microhypervisor_pool("cmn-main-sandbox-host", country_code="BR")
    b = pools.select_microhypervisor_pool("cmn-main-sandbox-host", country_code="DE")
    assert a["macrohypervisor_id"] == b["macrohypervisor_id"] == "macrohv-cmn-main-open-world"
    assert a["land_bundle_id"] == b["land_bundle_id"] == "obj-lab-land-bundle"
    assert a["microhypervisor_id"] == "microhv-cmn-main-cplp-pt-pt"
    assert b["microhypervisor_id"] == "microhv-cmn-main-intl-en-gb"
    assert a["microhypervisor_id"] != b["microhypervisor_id"]


def test_attach_session_pool():
    sess = pools.attach_session_pool(
        {"account_id": "user-test-01"},
        country_code="MZ",
        realm_id="lore-olissippo-lusitanian",
    )
    assert sess["player_pool"] == "cplp"
    assert sess["locale_norm"] == "pt-PT"
    assert sess["microhypervisor_id"] == "microhv-lusitania-cplp-pt-pt"
    assert sess["macrohypervisor_id"] == "macrohv-lusitania-olissippo"
    assert sess["pool_selection"]["geo_primary"] is True
    assert sess["pool_selection"]["accept_language_primary"] is False

    forced = pools.attach_session_pool(
        {"account_id": "user-test-02", "country_code": "PT"},
        explicit_pool="international",
    )
    assert forced["player_pool"] == "international"
    assert forced["pool_selection"]["explicit_override"] is True


def test_realms_json_stamps():
    realms = json.loads((ROOT / "contracts/cmn/realms.json").read_text())
    by = {r["realm_id"]: r for r in realms["realms"]}
    for rid in ("cmn-main-sandbox-host", "lore-olissippo-lusitanian"):
        r = by[rid]
        assert r.get("macrohypervisor_id")
        ids = r["microhypervisor_ids"]
        assert any(i.endswith("cplp-pt-pt") for i in ids)
        assert any(i.endswith("intl-en-gb") for i in ids)
        pool_by = {p["player_pool"]: p for p in r["microhypervisor_pools"]}
        assert pool_by["cplp"]["locale_norm"] == "pt-PT"
        assert pool_by["international"]["locale_norm"] == "en-GB"
        assert pool_by["cplp"]["microhypervisor_id"].endswith("cplp-pt-pt")
        assert pool_by["international"]["microhypervisor_id"].endswith("intl-en-gb")


def test_olissippo_world_json_stamps():
    for rel in (
        "contracts/mud/olissippo-world.json",
        "frontend/olissippo-world.json",
    ):
        w = json.loads((ROOT / rel).read_text())
        assert w["macrohypervisor_id"] == "macrohv-lusitania-olissippo"
        assert "microhv-lusitania-cplp-pt-pt" in w["microhypervisor_ids"]
        assert "microhv-lusitania-intl-en-gb" in w["microhypervisor_ids"]
        pool_by = {p["player_pool"]: p for p in w["microhypervisor_pools"]}
        assert pool_by["cplp"]["locale_norm"] == "pt-PT"
        assert pool_by["international"]["locale_norm"] == "en-GB"
        assert w["phase"].get("9b_language_pools") == "cplp_pt_pt_intl_en_gb_microhv"
        assert w["semantic_map"]["microhypervisor"] == "language_pool_mirror_same_land_bundle"


def test_ontology_unchanged_acb_not_nft():
    # Gens/populus/Lusitani + ACB≠NFT stay intact in world contract
    w = json.loads((ROOT / "contracts/mud/olissippo-world.json").read_text())
    assert w["playable_unit"] == "gens"
    assert w["semantic_map"]["gens"] == "playable_house"
    assert w["semantic_map"]["populus"] == "tribe_gentes"
    assert w["semantic_map"]["confederation"] == "lusitani"
    note = (w.get("ontology_note") or "") + json.dumps(w.get("subject_seeds") or [])
    # subjects remain ACB ids, not NFT object ids
    for s in w.get("subject_seeds") or []:
        sid = s.get("subject_id") or s.get("id") or ""
        assert not str(sid).startswith("obj-"), sid



def test_player_page_pt_host_pool_crosslink():
    """PT player briefing must surface CPLP/Intl pools + hypervisor doc (parity with EN)."""
    page = (ROOT / "frontend/lusitania.html").read_text()
    assert "macrohypervisor" in page
    assert "microhypervisor" in page
    assert "CPLP" in page and "PT-PT" in page
    assert "EN-GB" in page
    assert "OPEN-WORLD-HYPERVISORS.md" in page
    # PT section (not only EN) carries pool gloss
    pt = page.split('id="pt"', 1)[1].split('id="en"', 1)[0]
    assert "CPLP" in pt and "PT-PT" in pt
    assert "macrohypervisor" in pt or "macrohypervisor" in pt.lower()
    assert "OPEN-WORLD-HYPERVISORS.md" in pt


def test_docs_pointers():
    ow = (ROOT / "docs/OPEN-WORLD-HYPERVISORS.md").read_text()
    assert "olissippo_player_pools" in ow
    assert "resolve_player_pool" in ow
    assert "/lusitania" in ow
    assert "frontend/lusitania.html" in ow
    ui = (ROOT / "docs/UI-LOCALE-CPLP.md").read_text()
    assert "olissippo_player_pools" in ui or "player pool" in ui.lower()
    assert "geo" in ui.lower() or "geolocation" in ui.lower()


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
    print("olissippo-player-pools ok")
