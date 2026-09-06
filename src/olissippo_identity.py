#!/usr/bin/env python3
"""ACB identity (StrataMesh) vs world role (CMN).

Identity answers WHO the Subject is (registered in StrataMesh).
World role answers WHAT they do in a realm (registered in CMN).
They must not be conflated. ACB ≠ NFT either way.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ID_INDEX = ROOT / "contracts" / "stratamesh" / "subject-identities.json"
ROLE_INDEX = ROOT / "contracts" / "cmn" / "world-roles.json"
ID_DIR = ROOT / "contracts" / "stratamesh"
ROLE_DIR = ROOT / "contracts" / "cmn"


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def load_identity_index() -> dict[str, Any]:
    return _load_json(ID_INDEX)


def load_role_index() -> dict[str, Any]:
    return _load_json(ROLE_INDEX)


def resolve_subject_id(raw: str) -> str:
    """Map legacy lore-coupled ids (acb-oli-*) to StrataMesh subject_id."""
    if not raw:
        raise ValueError("empty_subject_id")
    if raw.startswith("obj-") or raw.startswith("object_"):
        raise ValueError("acb_is_not_nft")
    idx = load_identity_index()
    for entry in idx.get("identities", []):
        if entry["subject_id"] == raw:
            return raw
        if raw in (entry.get("aliases") or []):
            return entry["subject_id"]
    # already canonical or unknown — return as-is if looks like acb-/user-
    if raw.startswith(("acb-", "user-", "sca-")):
        return raw
    raise ValueError(f"unknown_subject:{raw}")


def load_identity(subject_id: str) -> dict[str, Any]:
    sid = resolve_subject_id(subject_id)
    idx = load_identity_index()
    entry = next((e for e in idx["identities"] if e["subject_id"] == sid), None)
    if not entry:
        raise KeyError(f"identity_not_registered:{sid}")
    data = _load_json(ID_DIR / entry["file"])
    assert data["registry"] == "stratamesh"
    assert data["kind"] in ("user", "sca", "acb")
    assert "object_id" not in data
    assert data.get("role") is None  # identity must not carry world role
    return data


def load_world_role(role_id: str) -> dict[str, Any]:
    idx = load_role_index()
    entry = next((e for e in idx["roles"] if e["role_id"] == role_id), None)
    if not entry:
        raise KeyError(f"world_role_not_registered:{role_id}")
    data = _load_json(ROLE_DIR / entry["file"])
    assert data["registry"] == "cmn"
    assert data["subject_id"] == resolve_subject_id(data["subject_id"])
    # role must not pretend to be identity registry
    assert data.get("kind") is None
    return data


def world_roles_for_subject(subject_id: str, *, realm: str | None = None) -> list[dict[str, Any]]:
    sid = resolve_subject_id(subject_id)
    out = []
    for entry in load_role_index().get("roles", []):
        if entry["subject_id"] != sid:
            continue
        role = load_world_role(entry["role_id"])
        if realm and role.get("realm") != realm:
            continue
        out.append(role)
    return out


def join_persona(slug_or_sid: str) -> dict[str, Any]:
    """Join StrataMesh identity + CMN Olissippo world role for a persona slug or id."""
    from olissippo_personas import load_persona  # local cycle ok at call time

    # prefer slug via personas index
    try:
        from olissippo_personas import load_index
        idx = load_index()
        entry = next((p for p in idx["personas"] if p["slug"] == slug_or_sid or p["subject_id"] == resolve_subject_id(slug_or_sid)), None)
    except Exception:
        entry = None
    if entry:
        persona = load_persona(entry["slug"])
    else:
        # fall back: boutius file path conventions
        raise KeyError(f"persona_not_found:{slug_or_sid}")

    ident = load_identity(persona["subject_id"])
    role = load_world_role(persona["world_role_id"])
    assert ident["subject_id"] == role["subject_id"]
    return {
        "identity": ident,
        "world_role": role,
        "persona": persona,
        "subject_id": ident["subject_id"],
        "world_role_id": role["role_id"],
        "kind": ident["kind"],
        "display_name": ident["display_name"],
        "role": role["role"],
        "home_location": role["home_location"],
        "primary_goal": role["primary_goal"],
        "realm": role["realm"],
        "identity_registry": "stratamesh",
        "world_role_registry": "cmn",
        "is_nft": False,
        "is_object": False,
        "is_subject": True,
    }


def assert_identity_not_role(identity: dict[str, Any]) -> None:
    if identity.get("registry") != "stratamesh":
        raise AssertionError("identity_must_be_stratamesh")
    if "role" in identity and identity["role"] is not None:
        raise AssertionError("identity_must_not_carry_world_role")
    if identity.get("world_role_id"):
        raise AssertionError("identity_must_not_embed_world_role_id")


def assert_role_not_identity(role: dict[str, Any]) -> None:
    if role.get("registry") != "cmn":
        raise AssertionError("world_role_must_be_cmn")
    if role.get("kind") in ("user", "sca", "acb"):
        raise AssertionError("world_role_must_not_carry_subject_kind")
