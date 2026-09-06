#!/usr/bin/env python3
"""Grove Lex — Nomic-like mutable rules (Phase 7)."""
from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "contracts" / "mud" / "olissippo-grove-lex-nomic.json"


@lru_cache(maxsize=1)
def load_lex() -> dict[str, Any]:
    data = json.loads(PATH.read_text())
    assert data.get("realm") == "lore-olissippo-lusitanian"
    return data


def immutable_ids(data: dict[str, Any] | None = None) -> set[str]:
    d = data or load_lex()
    return {r["id"] for r in d["immutable_core"]}


def active_mutable(state: dict[str, Any] | None = None, data: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    d = data or load_lex()
    if state and "mutable" in state:
        return [r for r in state["mutable"] if r.get("status") == "active"]
    return [r for r in d["mutable_seed"] if r.get("status") == "active"]


def new_state(data: dict[str, Any] | None = None) -> dict[str, Any]:
    d = data or load_lex()
    return {
        "mutable": deepcopy(d["mutable_seed"]),
        "proposals": {},
        "votes": {},
    }


def propose_lex(state: dict[str, Any], proposer: str, text: str, target_id: str | None = None, *, replace: bool = False) -> dict[str, Any]:
    d = load_lex()
    if target_id and target_id in immutable_ids(d):
        return {"ok": False, "error": "cannot_target_immutable", "target_id": target_id}
    pid = f"prop-{len(state.get('proposals', {})) + 1}"
    state.setdefault("proposals", {})[pid] = {
        "id": pid,
        "proposer": proposer,
        "text": text,
        "target_id": target_id,
        "replace": replace,
        "status": "open",
    }
    state.setdefault("votes", {})[pid] = {}
    return {"ok": True, "proposal_id": pid}


def vote_lex(state: dict[str, Any], proposal_id: str, voter: str, aye: bool) -> dict[str, Any]:
    if proposal_id not in state.get("proposals", {}):
        return {"ok": False, "error": "unknown_proposal"}
    if state["proposals"][proposal_id]["status"] != "open":
        return {"ok": False, "error": "not_open"}
    state.setdefault("votes", {}).setdefault(proposal_id, {})[voter] = bool(aye)
    return {"ok": True, "proposal_id": proposal_id, "votes": dict(state["votes"][proposal_id])}


def enact_lex(state: dict[str, Any], proposal_id: str) -> dict[str, Any]:
    d = load_lex()
    prop = state.get("proposals", {}).get(proposal_id)
    if not prop or prop["status"] != "open":
        return {"ok": False, "error": "not_open"}
    votes = state.get("votes", {}).get(proposal_id, {})
    quorum = int(d["proposal"]["quorum"])
    if len(votes) < quorum:
        return {"ok": False, "error": "no_quorum", "votes": len(votes), "need": quorum}
    ayes = sum(1 for v in votes.values() if v)
    majority = float(d["proposal"]["majority"])
    if ayes / len(votes) <= majority:
        return {"ok": False, "error": "no_majority", "ayes": ayes, "total": len(votes)}

    mutable = state.setdefault("mutable", [])
    tid = prop.get("target_id")
    if tid and prop.get("replace"):
        for r in mutable:
            if r["id"] == tid:
                if tid in immutable_ids(d):
                    return {"ok": False, "error": "cannot_target_immutable"}
                r["text"] = prop["text"]
                r["status"] = "active"
                prop["status"] = "enacted"
                return {"ok": True, "enacted": tid, "mode": "replace"}
        return {"ok": False, "error": "target_missing"}
    if tid and not prop.get("replace"):
        # repeal
        for r in mutable:
            if r["id"] == tid:
                r["status"] = "repealed"
                prop["status"] = "enacted"
                return {"ok": True, "enacted": tid, "mode": "repeal"}
        return {"ok": False, "error": "target_missing"}
    new_id = f"lex-mut-{proposal_id}"
    mutable.append({"id": new_id, "text": prop["text"], "status": "active"})
    prop["status"] = "enacted"
    return {"ok": True, "enacted": new_id, "mode": "add"}
