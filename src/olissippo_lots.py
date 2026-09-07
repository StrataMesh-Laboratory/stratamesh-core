#!/usr/bin/env python3
"""Olissippo Phase 8A — STRATA Lot Objects (fungible). Production mints/increments lots."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

RESOURCE_KINDS = ("herd", "grain", "timber", "ore")


def lot_object_id(castro_id: str, resource: str) -> str:
    return f"obj-oli-lot-{castro_id}-{resource}"


def make_lot(
    *,
    castro_id: str,
    resource: str,
    qty: int = 0,
    holder_subject: str | None = None,
) -> dict[str, Any]:
    """Lot Object — always STRATA NFT family (fungible lot)."""
    if resource not in RESOURCE_KINDS:
        raise ValueError(f"bad_resource:{resource}")
    return {
        "object_id": lot_object_id(castro_id, resource),
        "kind": "fungible_strata_lot",
        "is_nft": True,
        "nft_family": "STRATA",
        "is_subject": False,
        "castro_id": castro_id,
        "resource": resource,
        "qty": int(qty),
        "holder_subject": holder_subject,
    }


def ensure_castro_lots(castro: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Ensure lot_object_ids + lots map on a castro Object."""
    cid = castro["castro_id"]
    castro.setdefault("object_id", f"obj-oli-{cid}")
    castro.setdefault("is_nft", True)
    castro.setdefault("nft_family", "STRATA")
    lot_ids = castro.setdefault(
        "lot_object_ids",
        {r: lot_object_id(cid, r) for r in RESOURCE_KINDS},
    )
    lots = castro.setdefault("lots", {})
    res = castro.get("resources") or {}
    holder = castro.get("holder_subject")
    for r in RESOURCE_KINDS:
        oid = lot_ids.setdefault(r, lot_object_id(cid, r))
        if r not in lots:
            lots[r] = make_lot(castro_id=cid, resource=r, qty=int(res.get(r, 0)), holder_subject=holder)
        else:
            lots[r]["object_id"] = oid
            lots[r]["qty"] = int(res.get(r, lots[r].get("qty", 0)))
            lots[r]["is_nft"] = True
            lots[r]["nft_family"] = "STRATA"
    return lots


def mint_lot(
    bag_or_lots: dict[str, Any],
    *,
    castro_id: str,
    resource: str,
    qty: int,
    holder_subject: str | None = None,
) -> dict[str, Any]:
    """Create or increase a lot. Production creates lots."""
    if qty < 0:
        return {"ok": False, "error": "bad_qty"}
    # Accept either a dedicated lots store or a castro dict
    if "castro_id" in bag_or_lots and bag_or_lots.get("castro_id") == castro_id:
        castro = bag_or_lots
        ensure_castro_lots(castro)
        lot = castro["lots"][resource]
        before = int(lot["qty"])
        lot["qty"] = before + int(qty)
        castro.setdefault("resources", {})[resource] = lot["qty"]
        if holder_subject:
            lot["holder_subject"] = holder_subject
        return {"ok": True, "lot": deepcopy(lot), "minted": qty, "before": before, "after": lot["qty"]}

    store = bag_or_lots.setdefault("lots", {})
    oid = lot_object_id(castro_id, resource)
    lot = store.get(oid)
    if not lot:
        lot = make_lot(castro_id=castro_id, resource=resource, qty=0, holder_subject=holder_subject)
        store[oid] = lot
    before = int(lot["qty"])
    lot["qty"] = before + int(qty)
    if holder_subject:
        lot["holder_subject"] = holder_subject
    return {"ok": True, "lot": deepcopy(lot), "minted": qty, "before": before, "after": lot["qty"]}


def transfer_lot(
    from_castro: dict[str, Any],
    to_castro: dict[str, Any],
    resource: str,
    qty: int,
) -> dict[str, Any]:
    """Move lot qty between two castros (STRATA Objects)."""
    if qty <= 0:
        return {"ok": False, "error": "bad_qty"}
    ensure_castro_lots(from_castro)
    ensure_castro_lots(to_castro)
    src = from_castro["lots"][resource]
    if int(src["qty"]) < qty:
        return {"ok": False, "error": "insufficient_lot"}
    dst = to_castro["lots"][resource]
    src["qty"] = int(src["qty"]) - qty
    dst["qty"] = int(dst["qty"]) + qty
    from_castro.setdefault("resources", {})[resource] = src["qty"]
    to_castro.setdefault("resources", {})[resource] = dst["qty"]
    return {
        "ok": True,
        "resource": resource,
        "qty": qty,
        "from": from_castro["castro_id"],
        "to": to_castro["castro_id"],
        "from_lot": src["object_id"],
        "to_lot": dst["object_id"],
    }


def aggregates(castro: dict[str, Any]) -> dict[str, Any]:
    """Sum lot qtys (mirrors resources after sync)."""
    ensure_castro_lots(castro)
    by_resource = {r: int(castro["lots"][r]["qty"]) for r in RESOURCE_KINDS}
    return {
        "ok": True,
        "castro_id": castro["castro_id"],
        "object_id": castro.get("object_id"),
        "by_resource": by_resource,
        "total_qty": sum(by_resource.values()),
        "lot_object_ids": dict(castro.get("lot_object_ids") or {}),
    }


def sync_resources_from_lots(castro: dict[str, Any]) -> None:
    ensure_castro_lots(castro)
    res = castro.setdefault("resources", {})
    for r in RESOURCE_KINDS:
        res[r] = int(castro["lots"][r]["qty"])


def sync_lots_from_resources(castro: dict[str, Any]) -> None:
    ensure_castro_lots(castro)
    res = castro.get("resources") or {}
    for r in RESOURCE_KINDS:
        castro["lots"][r]["qty"] = int(res.get(r, 0))
