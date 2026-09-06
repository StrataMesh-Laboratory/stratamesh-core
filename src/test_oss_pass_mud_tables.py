#!/usr/bin/env python3
"""oss-pass-atelier-mud-oz: MUD tables + OZ scaffold exist and stay honest."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_mud_tables():
    data = json.loads((ROOT / "contracts/mud/tables.json").read_text())
    assert data["oracle_live"] is False
    for name in ("Object", "Parcel", "Subject"):
        assert name in data["tables"]
        assert "key" in data["tables"][name]
    obj = data["tables"]["Object"]
    assert "object_id" in obj["key"]
    rules = " ".join(obj["rules"]).lower()
    assert "sca" in rules or "subject" in " ".join(data["tables"]["Subject"]["rules"]).lower()


def test_oz_scaffold_no_strata_mint():
    sol = (ROOT / "contracts/openzeppelin/ObjectRegistry.sol").read_text()
    assert "NoStrataMint" in sol
    assert "ParcelImmovable" in sol
    assert "mintStrata" in sol


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
