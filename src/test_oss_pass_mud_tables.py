#!/usr/bin/env python3
"""oss-pass-atelier-mud-oz: ontology-aligned MUD tables + OZ scaffold honesty."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_mud_tables():
    data = json.loads((ROOT / "contracts/mud/tables.json").read_text())
    assert data["oracle_live"] is False
    tables = data["tables"]
    for name in ("Object", "Parcel", "Subject", "Lot", "Contract", "AspectEdge", "Balance"):
        assert name in tables, name
    obj = tables["Object"]
    assert "object_id" in obj["key"]
    rules = " ".join(obj["rules"]).lower()
    assert "lot" in rules and "forbidden" in rules
    assert "sca" in rules
    lot_rules = " ".join(tables["Lot"]["rules"]).lower()
    assert "not object_id" in lot_rules and "not an nft" in lot_rules
    subj_rules = " ".join(tables["Subject"]["rules"]).lower()
    assert "sca" in subj_rules and "subjects not objects" in subj_rules
    parcel_rules = " ".join(tables["Parcel"]["rules"]).lower()
    assert "title" in parcel_rules and "unmovable" in parcel_rules
    mud = (ROOT / "docs/MUD-WORLD-FOG-TABLES.md").read_text()
    for name in ("Subject", "Object", "Parcel", "Lot", "Contract", "Aspect", "Balance"):
        assert name in mud, name
    assert "NOT object_id" in mud or "lot_id ≠ object_id" in mud or "lot_id != object_id" in mud
    assert "aspects" in mud.lower() and "contracts" in mud.lower()
    assert "plain english" in mud.lower() or "ordinary" in mud.lower() or "plain word" in mud.lower()
    # collateral vs Agora ownership price
    for name in ("OwnershipFraction", "Collateral"):
        assert name in tables, name
    own = " ".join(tables["OwnershipFraction"]["rules"]).lower()
    assert "p_market" in own and "collateral" in own
    assert "not the collateral value" in own or "p_market is not the collateral" in own
    col = " ".join(tables["Collateral"]["rules"]).lower()
    assert "static" in col and "dynamic" in col and "burn" in col
    ont = (ROOT / "docs/STRATA_NFT_ONTOLOGY.md").read_text()
    assert "P_market" in ont and "Collateral" in ont
    assert "Bundle" in ont or "aspect" in ont.lower()
    ae_rules = " ".join(tables["AspectEdge"]["rules"]).lower()
    assert "own object_id" in ae_rules or "own object_id / strata nft" in ae_rules
    assert "desk" in ae_rules and "drawer" in ae_rules
    assert "all object kinds" in ae_rules or "all object" in ae_rules
    assert "P_market ≠" in ont or "P_market !=" in ont or "not equal" in ont.lower()



def test_oz_scaffold_no_strata_mint():
    sol = (ROOT / "contracts/openzeppelin/ObjectRegistry.sol").read_text()
    assert "NoStrataMint" in sol
    assert "ParcelImmovable" in sol
    assert "mintStrata" in sol
    assert "title is not this registry" in sol.lower() or "dirt identity" in sol.lower()


def test_atelier_vendor_three():
    assert (ROOT / "frontend/vendor/three.min.js").is_file()
    html = (ROOT / "frontend/gnu-atelier.html").read_text(errors="replace")
    assert "/vendor/three.min.js" in html
    assert "paintBancadaNow" in html
    assert "unpkg.com/three" not in html
    assert "@react-three" not in html
    assert "react-three-fiber" not in html
    tok = (ROOT / "frontend/tokenize.html").read_text(errors="replace")
    assert "unmovable: true" in tok
    assert "faucet" not in tok.lower()
    oz = (ROOT / "contracts/openzeppelin/ObjectRegistry.sol").read_text()
    assert "workers.dev" not in oz
    assert "NoStrataMint" in oz
    q = (ROOT / "frontend/atelier-quality.js").read_text()
    assert "AtelierQuality" in q
    assert "import " not in q
    assert "/atelier-quality.js" in html
    assert (ROOT / "frontend/vendor/stats.min.js").is_file()
    assert "stats.min.js" in html
    assert "debug=1" in html
    inst = (ROOT / "frontend/atelier-instances.js").read_text()
    assert "InstancedMesh" in inst
    assert "disposeTree" in inst
    unix = (ROOT / "frontend/atelier-unix.js").read_text()
    assert "streetDashes" in unix
    assert "disposeTree" in unix
    portal = (ROOT / "frontend/portal-pt.html").read_text(errors="replace")
    assert "/vendor/three.r128.min.js" in portal
    assert "cdnjs.cloudflare.com/ajax/libs/three" not in portal
    assert "streetDashes" in portal
    assert (ROOT / "frontend/vendor/three.r128.min.js").is_file()
    assert (ROOT / "frontend/vendor/OrbitControls.js").is_file()
    assert (ROOT / "frontend/vendor/PointerLockControls.js").is_file()
    assert (ROOT / "frontend/vendor/nipplejs.min.js").is_file()
    q = (ROOT / "frontend/atelier-quality.js").read_text()
    assert "1.25" in q and "1.5" in q
    assert (ROOT / "docs/ATELIER-GLTF-PIPELINE.md").is_file()
    assert (ROOT / "frontend/vendor/gltf/README.md").is_file()
    assert (ROOT / "docs/MUD-WORLD-FOG-TABLES.md").is_file()
    poc = (ROOT / "contracts/strata/StrataPoc20.sol").read_text()
    assert "onlyMinter" in poc and "NoFaucet" in poc
    assert "faucet" in poc
    erc721 = (ROOT / "contracts/strata/Object721.sol").read_text()
    assert "ParcelImmovable" in erc721
    assert "ownership_title" in erc721 or "title" in erc721.lower()
    erc1155 = (ROOT / "contracts/strata/Object1155.sol").read_text()
    assert "NoStrataMint" in erc1155
    assert "NOT object_id" in erc1155 or "not object_id" in erc1155.lower() or "lots" in erc1155.lower()


def test_atelier_quality_scripts():
    html = (ROOT / "frontend/gnu-atelier.html").read_text(errors="replace")
    assert "atelier-quality.js" in html
    assert "atelier-instances.js" in html
    assert "AtelierQuality" in html
    assert (ROOT / "frontend/atelier-quality.js").is_file()
    assert (ROOT / "frontend/atelier-instances.js").is_file()
    assert (ROOT / "frontend/vendor/stats.min.js").is_file()
    assert "Stats" in (ROOT / "frontend/vendor/stats.min.js").read_text(errors="replace")
    unix = (ROOT / "frontend/atelier-unix.js").read_text(errors="replace")
    assert "streetDashes" in unix
    assert "disposeTree" in unix
    assert "FogExp2" in unix or "fog" in unix.lower()


def test_strata_poc_contracts():
    erc = (ROOT / "contracts/strata/StrataERC20.sol").read_text()
    assert "POC_MINTER_ROLE" in erc
    assert "onlyRole(POC_MINTER_ROLE)" in erc
    nft = (ROOT / "contracts/strata/StrataObjectNFT.sol").read_text()
    assert "ParcelImmovable" in nft
    assert "POC_MINTER_ROLE" in nft
    assert "lots are not NFTs" in nft.lower() or "not \"lot\"" in nft.lower() or "unmovable world parcel" in nft.lower()
    cat = (ROOT / "contracts/strata/StrataCatalog1155.sol").read_text()
    assert "POC_MINTER_ROLE" in cat
    assert "lots" in cat.lower()
    assert (ROOT / "docs/ATELIER-GLTF-PIPELINE.md").is_file()
    assert (ROOT / "frontend/vendor/gltf/README.md").is_file()
    mud = (ROOT / "docs/MUD-WORLD-FOG-TABLES.md").read_text()
    for name in ("Subject", "Object", "Parcel", "Lot", "Contract", "Balance"):
        assert name in mud, name


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
    print("oss-pass-atelier-mud-oz ok")
