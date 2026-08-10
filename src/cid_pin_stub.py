"""
StrataMesh CID Pin Stub — Phase 1
=================================
Placeholder IPFS pinning interface used by Fog Nodes.
Real implementation will call a local IPFS daemon or a remote pinning service
under the terms of an SPA.

For now it:
- Records pin requests
- Reports status
- Can be swapped for a real client later without changing call sites
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Optional
import time


@dataclass
class PinRecord:
    cid: str
    requested_at: float
    status: str = "queued"  # queued | pinning | pinned | failed
    last_error: Optional[str] = None


class PinStub:
    def __init__(self):
        self.pins: Dict[str, PinRecord] = {}

    def request_pin(self, cid: str) -> PinRecord:
        if cid in self.pins and self.pins[cid].status == "pinned":
            return self.pins[cid]
        rec = PinRecord(cid=cid, requested_at=time.time(), status="pinning")
        # Simulate immediate success for the stub
        rec.status = "pinned"
        self.pins[cid] = rec
        return rec

    def status(self, cid: str) -> Optional[PinRecord]:
        return self.pins.get(cid)

    def summary(self) -> dict:
        counts = {"queued": 0, "pinning": 0, "pinned": 0, "failed": 0}
        for r in self.pins.values():
            counts[r.status] = counts.get(r.status, 0) + 1
        return {
            "total": len(self.pins),
            "by_status": counts,
            "note": "stub — replace with real IPFS client under SPA",
        }


# Convenience singleton for simple nodes
DEFAULT_PINNER = PinStub()
