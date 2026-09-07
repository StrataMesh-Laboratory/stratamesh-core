#!/usr/bin/env python3
"""Olissippo Phase 8A — universal Event helpers (law_version + reason on mutate)."""
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


@lru_cache(maxsize=1)
def load_event_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text())


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
    timestamp: Any = None,
    rule_version: str | None = None,
    provenance: dict[str, Any] | None = None,
    causes: list[str] | None = None,
    event_id: str | None = None,
) -> dict[str, Any]:
    """Build a universal Event. Mutating callers MUST pass reason + law_version (defaulted)."""
    if not reason:
        raise ValueError("reason_required")
    lv = law_version or DEFAULT_LAW_VERSION
    if not lv:
        raise ValueError("law_version_required")
    evt = {
        "event_id": event_id or f"evt-{uuid.uuid4().hex[:12]}",
        "event_type": event_type,
        "season": season,
        "timestamp": timestamp if timestamp is not None else {"unix": time.time()},
        "actor_subject_ids": list(actor_subject_ids or []),
        "object_ids": list(object_ids or []),
        "location_ids": list(location_ids or []),
        "verb": verb,
        "before": dict(before or {}),
        "after": dict(after or {}),
        "rule_version": rule_version or DEFAULT_RULE_VERSION,
        "law_version": lv,
        "provenance": provenance
        or {"source": "olissippo_events", "runtime": "sim", "note": "sim_layer_first"},
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
    bag.setdefault("events", []).append(event)
    bag["events"] = bag["events"][-500:]
    bag["last_event_id"] = event["event_id"]
    return event
