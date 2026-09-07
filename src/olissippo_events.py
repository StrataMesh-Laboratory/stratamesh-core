#!/usr/bin/env python3
"""Olissippo Phase 8D — universal Event helpers + provenance depth.

Mutating apply_* paths MUST emit Events with law_version + reason.
LLM narrates via explain_event(); server truth stays in Events.
"""
from __future__ import annotations

import json
import time
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "contracts" / "mud" / "olissippo-event-schema.json"
DEFAULT_RULE_VERSION = "verbs-8a-1"
DEFAULT_LAW_VERSION = "hearthlaw-1"

REQUIRED = (
    "event_id",
    "event_type",
    "season",
    "timestamp",
    "actor_subject_ids",
    "object_ids",
    "location_ids",
    "verb",
    "before",
    "after",
    "rule_version",
    "law_version",
    "provenance",
    "causes",
    "reason",
)

# Relations reconstructed by provenance_chain
REL_CREATED = "created_by"
REL_TRANSFERRED = "transferred"
REL_USED = "used"

_CREATED_TYPES = frozenset(
    {"production_tick", "lot_minted", "craft_unlock", "plant_castro", "castro_plant"}
)
_TRANSFER_TYPES = frozenset({"exchange", "transfer", "tribute", "cattle_raid"})
_USED_TYPES = frozenset({"craft_tick", "upgrade_work", "siege_enclosure", "reinforce"})


@lru_cache(maxsize=1)
def load_event_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text())


def _default_provenance() -> dict[str, Any]:
    return {"source": "olissippo_events", "runtime": "sim", "note": "sim_layer_first", "chain": []}


def make_event(
    *,
    event_type: str,
    verb: str,
    reason: str,
    law_version: str | None = None,
    actor_subject_ids: list[str] | None = None,
    object_ids: list[str] | None = None,
    location_ids: list[str] | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    season: int | None = None,
    game_month: int | None = None,
    timestamp: Any = None,
    rule_version: str | None = None,
    provenance: dict[str, Any] | list[Any] | None = None,
    causes: list[str] | None = None,
    event_id: str | None = None,
) -> dict[str, Any]:
    """Build a universal Event. Mutating callers MUST pass reason + law_version (defaulted)."""
    if not reason:
        raise ValueError("reason_required")
    lv = law_version or DEFAULT_LAW_VERSION
    if not lv:
        raise ValueError("law_version_required")
    eid = event_id or f"evt-{uuid.uuid4().hex[:12]}"
    # season / game_month: dynasty clock months may ride as game_month; Bandua uses season
    season_val = season
    if season_val is None and game_month is not None:
        season_val = game_month
    if provenance is None:
        prov: Any = _default_provenance()
    elif isinstance(provenance, list):
        prov = {"source": "olissippo_events", "runtime": "sim", "note": "sim_layer_first", "chain": list(provenance)}
    elif isinstance(provenance, dict):
        prov = dict(provenance)
        prov.setdefault("chain", list(prov.get("chain") or []))
    else:
        prov = _default_provenance()
    evt = {
        "event_id": eid,
        "event_type": event_type,
        "season": season_val,
        "game_month": game_month if game_month is not None else season_val,
        "timestamp": timestamp if timestamp is not None else {"unix": time.time()},
        "actor_subject_ids": list(actor_subject_ids or []),
        "object_ids": list(object_ids or []),
        "location_ids": list(location_ids or []),
        "verb": verb,
        "before": dict(before or {}),
        "after": dict(after or {}),
        "rule_version": rule_version or DEFAULT_RULE_VERSION,
        "law_version": lv,
        "provenance": prov,
        "causes": list(causes or []),
        "reason": str(reason),
    }
    for k in REQUIRED:
        if k not in evt:
            raise ValueError(f"missing_field:{k}")
    return evt


def append_event(bag: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    """Append Event to bag['events']; ensure law_version/reason present on mutate."""
    if not event.get("reason"):
        raise ValueError("reason_required")
    if not event.get("law_version"):
        raise ValueError("law_version_required")
    for k in REQUIRED:
        if k not in event:
            raise ValueError(f"missing_field:{k}")
    # stamp game_month from bag clock/kin when absent
    if event.get("game_month") is None:
        clk = bag.get("clock") or (bag.get("kin") or {}).get("clock") or {}
        if "game_month" in clk:
            event["game_month"] = clk.get("game_month")
        elif bag.get("game_month") is not None:
            event["game_month"] = bag.get("game_month")
        elif (bag.get("kin") or {}).get("game_month") is not None:
            event["game_month"] = bag["kin"]["game_month"]
    bag.setdefault("events", []).append(event)
    bag["events"] = bag["events"][-500:]
    bag["last_event_id"] = event["event_id"]
    return event


def _object_mentions(event: dict[str, Any], object_id: str) -> bool:
    if object_id in (event.get("object_ids") or []):
        return True
    after = event.get("after") or {}
    before = event.get("before") or {}
    blob = json.dumps({"a": after, "b": before}, sort_keys=True, default=str)
    if object_id in blob:
        return True
    prov = event.get("provenance")
    if isinstance(prov, dict):
        for step in prov.get("chain") or []:
            if isinstance(step, dict) and step.get("object_id") == object_id:
                return True
            if isinstance(step, dict) and object_id in (step.get("object_ids") or []):
                return True
    elif isinstance(prov, list):
        for step in prov:
            if isinstance(step, dict) and (
                step.get("object_id") == object_id or object_id in (step.get("object_ids") or [])
            ):
                return True
    return False


def _classify_relation(event: dict[str, Any]) -> str:
    et = str(event.get("event_type") or "")
    verb = str(event.get("verb") or "")
    if et in _CREATED_TYPES or verb in ("tick_production", "production_tick", "plant_castro"):
        return REL_CREATED
    if et in _TRANSFER_TYPES or verb in ("exchange", "quay_barter", "castro_quay_barter"):
        return REL_TRANSFERRED
    if et in _USED_TYPES or verb in ("craft_tick", "unlock_craft", "upgrade_work"):
        return REL_USED
    # provenance chain hint
    prov = event.get("provenance")
    if isinstance(prov, dict):
        for step in prov.get("chain") or []:
            if isinstance(step, dict) and step.get("relation") in (REL_CREATED, REL_TRANSFERRED, REL_USED):
                return str(step["relation"])
    return REL_USED if et else REL_CREATED


def provenance_chain(object_id: str, events: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Reconstruct created_by → transferred → used for a STRATA Object from Events.

    Returns ordered steps (oldest first). Empty if object never appears.
    """
    if not object_id or not events:
        return []
    chain: list[dict[str, Any]] = []
    for evt in events:
        if not isinstance(evt, dict):
            continue
        # prefer explicit provenance.chain entries for this object
        prov = evt.get("provenance")
        explicit = []
        if isinstance(prov, dict):
            explicit = [s for s in (prov.get("chain") or []) if isinstance(s, dict)]
        elif isinstance(prov, list):
            explicit = [s for s in prov if isinstance(s, dict)]
        matched_explicit = [
            s
            for s in explicit
            if s.get("object_id") == object_id or object_id in (s.get("object_ids") or [])
        ]
        if matched_explicit:
            for s in matched_explicit:
                chain.append(
                    {
                        "relation": s.get("relation") or _classify_relation(evt),
                        "object_id": object_id,
                        "event_id": evt.get("event_id"),
                        "event_type": evt.get("event_type"),
                        "verb": evt.get("verb"),
                        "law_version": evt.get("law_version"),
                        "reason": evt.get("reason") or s.get("reason"),
                        "via": s.get("via") or evt.get("verb"),
                        "actor_subject_ids": list(evt.get("actor_subject_ids") or []),
                        "detail": {k: v for k, v in s.items() if k not in ("relation", "object_id")},
                    }
                )
            continue
        if not _object_mentions(evt, object_id):
            continue
        rel = _classify_relation(evt)
        chain.append(
            {
                "relation": rel,
                "object_id": object_id,
                "event_id": evt.get("event_id"),
                "event_type": evt.get("event_type"),
                "verb": evt.get("verb"),
                "law_version": evt.get("law_version"),
                "reason": evt.get("reason"),
                "via": evt.get("verb"),
                "actor_subject_ids": list(evt.get("actor_subject_ids") or []),
                "detail": {"after": evt.get("after") or {}, "before": evt.get("before") or {}},
            }
        )
    # stable order: created_by first when same timestamp ambiguity — keep event order
    order = {REL_CREATED: 0, REL_TRANSFERRED: 1, REL_USED: 2}
    # do not re-sort across time; only annotate
    for step in chain:
        step["ordinal"] = order.get(step["relation"], 9)
    return chain


def explain_event(event: dict[str, Any] | None) -> dict[str, Any]:
    """Server-truth reason dict for LLM narration (interpret only; do not mutate)."""
    if not event or not isinstance(event, dict):
        return {"ok": False, "error": "no_event", "narration_seed": ""}
    reason = str(event.get("reason") or "")
    verb = str(event.get("verb") or "")
    et = str(event.get("event_type") or "")
    lv = str(event.get("law_version") or "")
    actors = list(event.get("actor_subject_ids") or [])
    objects = list(event.get("object_ids") or [])
    return {
        "ok": True,
        "event_id": event.get("event_id"),
        "event_type": et,
        "verb": verb,
        "reason": reason,
        "resolution_reason": reason,
        "law_version": lv,
        "season": event.get("season"),
        "game_month": event.get("game_month"),
        "actor_subject_ids": actors,
        "object_ids": objects,
        "location_ids": list(event.get("location_ids") or []),
        "before": dict(event.get("before") or {}),
        "after": dict(event.get("after") or {}),
        "causes": list(event.get("causes") or []),
        "provenance": event.get("provenance"),
        "narration_seed": (
            f"{et or 'event'}:{verb} — {reason} (law {lv})"
            + (f"; actors={','.join(actors)}" if actors else "")
            + (f"; objects={','.join(objects)}" if objects else "")
        ),
        "llm_role": "interpret_only",
        "server_truth": True,
    }


def provenance_step(
    *,
    relation: str,
    object_id: str,
    via: str | None = None,
    reason: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    """Helper for apply_* paths to stamp provenance.chain entries."""
    step = {"relation": relation, "object_id": object_id, "via": via, "reason": reason}
    step.update(extra)
    return {k: v for k, v in step.items() if v is not None}
