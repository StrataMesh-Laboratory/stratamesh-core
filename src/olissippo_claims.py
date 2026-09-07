#!/usr/bin/env python3
"""Hill claims — CK-like territorial pretensions for stirps (Phase 7c).

Claims are legal/social edges — not NFT title, not collateral C.
"""
from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "contracts" / "mud" / "olissippo-stirps-claims.json"


@lru_cache(maxsize=1)
def load_claims() -> dict[str, Any]:
    data = json.loads(PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    return data


def new_state(data: dict[str, Any] | None = None) -> dict[str, Any]:
    d = data or load_claims()
    return {
        "claims": {c["claim_id"]: deepcopy(c) for c in d["seed_claims"]},
    }


def press_claim(
    state: dict[str, Any],
    stirps_id: str,
    territory_id: str,
    kind: str,
    holder_person_id: str,
    claim_id: str | None = None,
) -> dict[str, Any]:
    d = load_claims()
    if kind not in d["claim_kinds"]:
        return {"ok": False, "error": "bad_kind"}
    cid = claim_id or f"claim-{stirps_id}-{territory_id}-{kind}"
    if cid in state["claims"]:
        return {"ok": False, "error": "duplicate"}
    strength = int((d.get("strength") or {}).get(kind) or 1)
    rec = {
        "claim_id": cid,
        "stirps_id": stirps_id,
        "territory_id": territory_id,
        "kind": kind,
        "holder_person_id": holder_person_id,
        "strength": strength,
    }
    state["claims"][cid] = rec
    return {"ok": True, "claim": rec, "mechanic": "hill_claims"}


def renounce_claim(state: dict[str, Any], claim_id: str) -> dict[str, Any]:
    if claim_id not in state["claims"]:
        return {"ok": False, "error": "unknown_claim"}
    state["claims"].pop(claim_id)
    return {"ok": True, "renounced": claim_id}


def list_claims(state: dict[str, Any], territory_id: str | None = None, stirps_id: str | None = None) -> dict[str, Any]:
    out = []
    for c in state["claims"].values():
        if territory_id and c["territory_id"] != territory_id:
            continue
        if stirps_id and c["stirps_id"] != stirps_id:
            continue
        out.append(c)
    out.sort(key=lambda x: (-int(x.get("strength") or 0), x["claim_id"]))
    return {"ok": True, "claims": out}


def strongest_claim(state: dict[str, Any], territory_id: str) -> dict[str, Any]:
    r = list_claims(state, territory_id=territory_id)
    if not r["claims"]:
        return {"ok": False, "error": "no_claims"}
    return {"ok": True, "claim": r["claims"][0]}
