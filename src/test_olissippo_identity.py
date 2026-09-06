#!/usr/bin/env python3
"""Identity (StrataMesh) ≠ world role (CMN); lore ≠ main sandbox host."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import olissippo_identity as oid  # noqa: E402
import olissippo_boutius as bb  # noqa: E402
import olissippo_personas as op  # noqa: E402


def test_legacy_alias_resolves_to_stratamesh_identity():
    assert oid.resolve_subject_id("acb-oli-boutius-001") == "acb-boutius-001"
    assert oid.resolve_subject_id("acb-boutius-001") == "acb-boutius-001"


def test_identity_has_no_world_role_fields():
    ident = oid.load_identity("acb-boutius-001")
    oid.assert_identity_not_role(ident)
    assert ident["registry"] == "stratamesh"
    assert ident["kind"] == "acb"
    assert "object_id" not in ident


def test_world_role_is_cmn_lore_not_sandbox_host():
    role = oid.load_world_role("cmn-role-oli-smith-boutius")
    oid.assert_role_not_identity(role)
    assert role["registry"] == "cmn"
    assert role["realm"] == "lore-olissippo-lusitanian"
    assert role["not_main"] is True
    assert role["hosts_sandboxes"] is False
    assert role.get("same_mechanics_as_main") is True
    assert role["subject_id"] == "acb-boutius-001"


def test_realms_index_separates_main_and_lore():
    realms = json.loads((ROOT / "contracts/cmn/realms.json").read_text())
    by = {r["realm_id"]: r for r in realms["realms"]}
    assert by["cmn-main-sandbox-host"]["hosts_sandboxes"] is True
    assert by["cmn-main-sandbox-host"]["class"] == "main"
    oli = by["lore-olissippo-lusitanian"]
    assert oli["hosts_sandboxes"] is False
    assert oli["not_main"] is True
    assert oli["same_mechanics_as_main"] is True
    assert oli["class"] == "lore"


def test_persona_joins_both_registries():
    p = op.load_persona("boutius")
    assert p["subject_id"] == "acb-boutius-001"
    assert p["identity_registry"] == "stratamesh"
    assert p["world_role_registry"] == "cmn"
    assert p["world_role_id"].startswith("cmn-role-")
    st = bb.initial_state(p)
    assert st["subject_id"] == "acb-boutius-001"
    bb.assert_subject_not_nft(st)


def test_reject_object_as_identity():
    try:
        oid.resolve_subject_id("obj-oli-charcoal-01")
        assert False
    except ValueError as e:
        assert "nft" in str(e).lower() or "acb" in str(e).lower()


def test_docs_exist():
    assert (ROOT / "docs/ACB-IDENTITY-WORLD-ROLE.md").is_file()
    text = (ROOT / "docs/ACB-IDENTITY-WORLD-ROLE.md").read_text()
    assert "hosts sandboxes" in text.lower() or "Hosts sandboxes" in text
    assert "same mechanics" in text.lower()


def test_atelier_snapshot_lore_flags():
    snap = json.loads((ROOT / "frontend/olissippo-world.json").read_text())
    assert snap["not_main"] is True
    assert snap["hosts_sandboxes"] is False
    assert snap["same_mechanics_as_main"] is True
    assert snap["realm_class"] == "lore"
    for person in snap["people"]:
        assert person.get("identity_registry") == "stratamesh"
        assert person.get("world_role_registry") == "cmn"


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
    print("olissippo-identity ok")
