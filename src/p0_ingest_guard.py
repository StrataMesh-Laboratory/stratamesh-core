"""
P0 ingest guard — POST /tx/ingest validation (lab n=1 kernel).

Syntax (HTTP 400, code SYNTAX_ERRORS):
  blank tx_id · bad JSON · missing tx_id

Semantic (HTTP 200, accepted=false):
  duplicate tx_id · second empty-parents root · bad type · bad/unknown parents

Does NOT close multi-host P0. Does NOT claim mesh, mainnet, or aBFT.
A1 process-gossip (one runner, three OS processes) remains the live bar.
See docs/P0-PROCESS-INV-TX.md.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Iterable, Optional

from tip_selection import TxType

SYNTAX_ERRORS = "SYNTAX_ERRORS"
DUPLICATE_TX = "DUPLICATE_TX"
SECOND_ROOT = "SECOND_ROOT"
BAD_TYPE = "BAD_TYPE"
BAD_PARENTS = "BAD_PARENTS"

ALLOWED_TYPES = {t.value for t in TxType}


@dataclass(frozen=True)
class IngestDecision:
    http_status: int
    accepted: bool
    code: Optional[str]
    reason: str
    tx_id: Optional[str] = None
    tx_type: str = "standard"
    parents: tuple = ()
    weight: float = 1.0
    cid: Optional[str] = None
    sender: Optional[str] = None

    @property
    def body(self) -> dict:
        out: dict[str, Any] = {
            "accepted": self.accepted,
            "reason": self.reason,
        }
        if self.code:
            out["error"] = self.code
            out["code"] = self.code
        if self.tx_id is not None:
            out["tx_id"] = self.tx_id
        return out


def _syntax(reason: str, tx_id: Optional[str] = None) -> IngestDecision:
    return IngestDecision(
        http_status=400,
        accepted=False,
        code=SYNTAX_ERRORS,
        reason=reason,
        tx_id=tx_id,
    )


def _reject(code: str, reason: str, tx_id: Optional[str] = None) -> IngestDecision:
    return IngestDecision(
        http_status=200,
        accepted=False,
        code=code,
        reason=reason,
        tx_id=tx_id,
    )


def guard_ingest(
    raw: bytes,
    *,
    known_ids: Iterable[str],
    genesis_id: Optional[str] = "genesis",
) -> IngestDecision:
    """Classify a POST /tx/ingest body. Caller attaches only when accepted=True."""
    known = set(known_ids or [])
    try:
        text = (raw or b"").decode("utf-8")
        if not text.strip():
            data: Any = {}
        else:
            data = json.loads(text)
        if not isinstance(data, dict):
            raise ValueError("not an object")
    except Exception:
        return _syntax("bad json")

    if "tx_id" not in data:
        return _syntax("missing tx_id")

    raw_id = data.get("tx_id")
    if raw_id is None:
        return _syntax("blank id")
    if not isinstance(raw_id, str):
        raw_id = str(raw_id)
    tx_id = raw_id.strip() if isinstance(raw_id, str) else ""
    if not tx_id:
        return _syntax("blank id")

    if tx_id in known:
        return _reject(DUPLICATE_TX, "duplicate tx_id", tx_id=tx_id)

    tx_type = data.get("tx_type", "standard")
    if tx_type is None:
        tx_type = "standard"
    if not isinstance(tx_type, str) or tx_type not in ALLOWED_TYPES:
        return _reject(BAD_TYPE, "bad type", tx_id=tx_id)

    parents = data.get("parents")
    if parents is None:
        parents = []
    if not isinstance(parents, list):
        return _reject(BAD_PARENTS, "bad parents", tx_id=tx_id)
    cleaned: list[str] = []
    for p in parents:
        if not isinstance(p, str) or not p.strip():
            return _reject(BAD_PARENTS, "bad parents", tx_id=tx_id)
        cleaned.append(p)

    root_exists = bool(genesis_id and genesis_id in known)
    if not cleaned:
        if root_exists and tx_id != genesis_id:
            return _reject(SECOND_ROOT, "second empty-parents root", tx_id=tx_id)

    missing = [p for p in cleaned if p not in known]
    if missing:
        return _reject(BAD_PARENTS, "unknown parents", tx_id=tx_id)

    weight = data.get("weight", 1.0)
    try:
        weight_f = float(1.0 if weight is None else weight)
    except (TypeError, ValueError):
        weight_f = 1.0

    cid = data.get("cid")
    sender = data.get("sender")
    return IngestDecision(
        http_status=200,
        accepted=True,
        code=None,
        reason="ok",
        tx_id=tx_id,
        tx_type=tx_type,
        parents=tuple(cleaned),
        weight=weight_f,
        cid=cid if isinstance(cid, str) or cid is None else str(cid),
        sender=sender if isinstance(sender, str) or sender is None else str(sender),
    )
