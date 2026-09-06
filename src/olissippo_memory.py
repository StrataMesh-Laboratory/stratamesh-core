#!/usr/bin/env python3
"""Olissippo Phase 4 — MemoryEvent + SubjectEdge (ACB ≠ NFT).

Server-side continuity store. Memories attach to subject_id only.
Speech helpers cite stored events — never invent Object/NFT identity for ACBs.
"""
from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from typing import Any

import olissippo_boutius as bb

MEMORY_TYPES = frozenset({
    "trade", "work", "social", "rite", "oath", "threat", "gift", "speech", "other",
})


def _edge_key(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a < b else (b, a)


def _mem_id(subject_id: str, ts: str, summary: str) -> str:
    h = hashlib.sha1(f"{subject_id}|{ts}|{summary}".encode()).hexdigest()[:12]
    return f"mem-{h}"


def empty_store() -> dict[str, Any]:
    return {"MemoryEvent": [], "SubjectEdge": []}


def assert_subject_id(subject_id: str) -> None:
    if not subject_id or subject_id.startswith("obj-"):
        raise ValueError("memory_requires_subject_id")
    if subject_id.startswith("object_"):
        raise ValueError("memory_requires_subject_id")


def record_memory(
    store: dict[str, Any],
    *,
    subject_id: str,
    ts: str,
    type: str,
    summary: str,
    importance: float = 0.5,
    refs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Append a MemoryEvent. subject_id must be Subject — never object_id."""
    assert_subject_id(subject_id)
    if type not in MEMORY_TYPES:
        raise ValueError(f"unknown_memory_type:{type}")
    if "object_id" in (refs or {}) and refs and refs.get("self_is_nft"):
        raise ValueError("acb_is_not_nft")
    imp = max(0.0, min(1.0, float(importance)))
    ev = {
        "id": _mem_id(subject_id, ts, summary),
        "subject_id": subject_id,
        "ts": ts,
        "type": type,
        "summary": str(summary)[:400],
        "importance": imp,
        "refs": refs or {},
    }
    store = deepcopy(store)
    store.setdefault("MemoryEvent", []).append(ev)
    # cap per subject
    by_sub = [e for e in store["MemoryEvent"] if e["subject_id"] == subject_id]
    if len(by_sub) > 200:
        keep_ids = {e["id"] for e in sorted(by_sub, key=lambda x: x["importance"], reverse=True)[:200]}
        store["MemoryEvent"] = [
            e for e in store["MemoryEvent"]
            if e["subject_id"] != subject_id or e["id"] in keep_ids
        ]
    return store


def recall(
    store: dict[str, Any],
    subject_id: str,
    *,
    limit: int = 5,
    min_importance: float = 0.0,
    about_subject: str | None = None,
) -> list[dict[str, Any]]:
    assert_subject_id(subject_id)
    events = [
        e for e in store.get("MemoryEvent", [])
        if e["subject_id"] == subject_id and float(e.get("importance", 0)) >= min_importance
    ]
    if about_subject:
        events = [
            e for e in events
            if (e.get("refs") or {}).get("other_subject_id") == about_subject
            or about_subject in str(e.get("summary", ""))
        ]
    events.sort(key=lambda e: (float(e.get("importance", 0)), e.get("ts", "")), reverse=True)
    return events[:limit]


def get_edge(store: dict[str, Any], a_id: str, b_id: str) -> dict[str, Any] | None:
    assert_subject_id(a_id)
    assert_subject_id(b_id)
    ka, kb = _edge_key(a_id, b_id)
    for e in store.get("SubjectEdge", []):
        if e["a_id"] == ka and e["b_id"] == kb:
            return e
    return None


def upsert_edge(
    store: dict[str, Any],
    a_id: str,
    b_id: str,
    *,
    trust_delta: float = 0.0,
    familiarity_delta: float = 0.0,
    ts: str | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    """Raise or create SubjectEdge. Both ends are Subjects."""
    assert_subject_id(a_id)
    assert_subject_id(b_id)
    if a_id == b_id:
        raise ValueError("edge_requires_two_subjects")
    store = deepcopy(store)
    ka, kb = _edge_key(a_id, b_id)
    edges = store.setdefault("SubjectEdge", [])
    found = None
    for e in edges:
        if e["a_id"] == ka and e["b_id"] == kb:
            found = e
            break
    if found is None:
        found = {
            "a_id": ka,
            "b_id": kb,
            "trust": 0.1,
            "familiarity": 0.05,
            "last_ts": ts or "",
            "tags": [],
        }
        edges.append(found)
    found["trust"] = max(0.0, min(1.0, float(found["trust"]) + float(trust_delta)))
    found["familiarity"] = max(0.0, min(1.0, float(found["familiarity"]) + float(familiarity_delta)))
    if ts:
        found["last_ts"] = ts
    if tags:
        found["tags"] = sorted(set(found.get("tags") or []) | set(tags))
    return store


def speech_from_memory(
    store: dict[str, Any],
    speaker_id: str,
    other_id: str,
    *,
    display_name: str = "friend",
) -> str | None:
    """Day-2 continuity line citing stored trade/social memory."""
    mems = recall(store, speaker_id, limit=3, min_importance=0.4, about_subject=other_id)
    edge = get_edge(store, speaker_id, other_id)
    if not mems and not (edge and float(edge.get("familiarity", 0)) >= 0.2):
        return None
    bits = []
    for m in mems[:2]:
        bits.append(m["summary"])
    if edge and float(edge.get("familiarity", 0)) >= 0.3:
        fam = "again" if float(edge["familiarity"]) >= 0.5 else "once more"
        lead = f"You {fam}."
    else:
        lead = "You."
    if bits:
        return f"{lead} {bits[0]}"
    return lead


def record_from_action(
    store: dict[str, Any],
    state: dict[str, Any],
    *,
    other_subject_id: str | None = None,
) -> dict[str, Any]:
    """Derive MemoryEvent (+ optional edge) from last Subject action."""
    bb.assert_subject_not_nft(state)
    act = state.get("last_action") or {}
    if not isinstance(act, dict) or not act.get("ok"):
        return store
    sid = state["subject_id"]
    ts = f"d{state.get('day', 1)}m{state.get('minute', 0)}"
    typ = str(act.get("type") or "other")
    store2 = store

    if typ == "buy" and act.get("item") == "charcoal":
        qty = int(act.get("quantity") or 0)
        store2 = record_memory(
            store2,
            subject_id=sid,
            ts=ts,
            type="trade",
            summary=f"Bought {qty} charcoal at the lean-to.",
            importance=0.55,
            refs={"item": "charcoal", "quantity": qty, "location_id": state.get("location_id")},
        )
        if other_subject_id:
            store2 = record_memory(
                store2,
                subject_id=sid,
                ts=ts,
                type="trade",
                summary=f"Took charcoal from {other_subject_id} — saved the forge day.",
                importance=0.85,
                refs={"other_subject_id": other_subject_id, "item": "charcoal", "quantity": qty},
            )
            store2 = upsert_edge(
                store2, sid, other_subject_id,
                trust_delta=0.08, familiarity_delta=0.15, ts=ts, tags=["charcoal_trade"],
            )
    elif typ == "work":
        sp = act.get("spear_progress", state.get("spear_progress"))
        store2 = record_memory(
            store2,
            subject_id=sid,
            ts=ts,
            type="work",
            summary=f"Advanced chefe spear order to {sp}/12.",
            importance=0.45,
            refs={"spear_progress": sp},
        )
    elif typ == "say" and other_subject_id:
        speech = state.get("last_speech") or ""
        store2 = record_memory(
            store2,
            subject_id=sid,
            ts=ts,
            type="speech",
            summary=f"Spoke with {other_subject_id}: {str(speech)[:120]}",
            importance=0.5,
            refs={"other_subject_id": other_subject_id},
        )
        store2 = upsert_edge(
            store2, sid, other_subject_id,
            trust_delta=0.02, familiarity_delta=0.08, ts=ts, tags=["spoke"],
        )
    elif typ in ("rite_offer", "oath_bandua", "rite_heal", "rite_dream", "consult_omen"):
        store2 = record_memory(
            store2,
            subject_id=sid,
            ts=ts,
            type="rite" if typ.startswith("rite") or typ == "consult_omen" else "oath",
            summary=f"Performed {typ} at {state.get('location_id')}.",
            importance=0.7,
            refs={"action": typ, "location_id": state.get("location_id")},
        )
        if typ == "oath_bandua" and other_subject_id:
            store2 = upsert_edge(
                store2, sid, other_subject_id,
                trust_delta=0.12, familiarity_delta=0.1, ts=ts, tags=["bandua_oath"],
            )
    return store2


def day2_player_meet(
    store: dict[str, Any],
    boutius_state: dict[str, Any],
    player_id: str = "user-oli-player-001",
) -> tuple[dict[str, Any], str | None]:
    """Simulate Day-1 charcoal from player, return Day-2 speech citing memory."""
    bb.assert_subject_not_nft(boutius_state)
    assert_subject_id(player_id)
    # Day 1 trade memory (as if player sold charcoal)
    store = record_memory(
        store,
        subject_id=boutius_state["subject_id"],
        ts="d1m960",
        type="trade",
        summary=f"The charcoal you brought saved yesterday's work. The chefe still waits on spears.",
        importance=0.9,
        refs={"other_subject_id": player_id, "item": "charcoal", "quantity": 2},
    )
    store = upsert_edge(
        store,
        boutius_state["subject_id"],
        player_id,
        trust_delta=0.2,
        familiarity_delta=0.4,
        ts="d1m960",
        tags=["charcoal_trade"],
    )
    line = speech_from_memory(
        store,
        boutius_state["subject_id"],
        player_id,
        display_name=boutius_state.get("display_name", "Boutius"),
    )
    return store, line
