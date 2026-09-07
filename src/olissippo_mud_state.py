#!/usr/bin/env python3
"""GNU Graphical-MUD state logic — spatial presence / rooms / contents.

Architectural peer to the five strategic engines (not UI chrome).
Lattice MUD + Evennia patterns; Bancada/GNU Atelier only renders this state.
Subjects have location_id; Objects at locations are STRATA (object_id).
"""
from __future__ import annotations

from typing import Any

import olissippo_world as ow


ENGINE = "gnu_graphical_mud"
PATTERNS = ("lattice_mud", "evennia")
STAGE_RENDERERS = ("gnu_atelier", "bancada")


def engine_info() -> dict[str, Any]:
    return {
        "engine": ENGINE,
        "patterns": list(PATTERNS),
        "stage_renderers": list(STAGE_RENDERERS),
        "source_of_truth": "server",
        "view_only": list(STAGE_RENDERERS),
        "note": "Atelier/Bancada render; they do not author world state.",
    }


def locations(world: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    w = world or ow.load_world()
    return list(w.get("locations") or [])


def exits_from(location_id: str, world: dict[str, Any] | None = None) -> list[str]:
    adj = ow.adjacency(world)
    return sorted(adj.get(location_id) or [])


def objects_present(location_id: str, world: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """STRATA Objects (seed) currently at location — not Subjects."""
    return [
        {
            "object_id": o["object_id"],
            "name": o.get("name"),
            "template": o.get("template"),
            "qty": o.get("qty"),
            "is_nft": True,
            "nft_family": "STRATA",
        }
        for o in ow.objects_at(location_id, world)
    ]


def subjects_present(location_id: str, subject_states: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """ACB/human Subjects at location — never stamped as object_id/NFT."""
    out = []
    for s in subject_states:
        if s.get("location_id") != location_id:
            continue
        out.append({
            "subject_id": s.get("subject_id"),
            "kind": s.get("kind") or "acb",
            "is_nft": False,
            "is_subject": True,
        })
    return out


def validate_move(from_id: str, to_id: str, world: dict[str, Any] | None = None) -> dict[str, Any]:
    return ow.validate_move(from_id, to_id, world)


def stage_snapshot(
    location_id: str,
    subject_states: list[dict[str, Any]] | None = None,
    world: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Stage-facing bag for Atelier/Bancada — read-only view of mud state."""
    w = world or ow.load_world()
    return {
        "engine": ENGINE,
        "location_id": location_id,
        "exits": exits_from(location_id, w),
        "objects": objects_present(location_id, w),
        "subjects": subjects_present(location_id, subject_states or []),
        "numina": [
            {"numen_id": n["numen_id"], "rites": n.get("rites") or []}
            for n in ow.numen_at(location_id, w)
        ],
        "source_of_truth": "server",
        "renderer_hint": "gnu_atelier",
    }
