"""
Proof of Contribution — Phase 3 scaffold
========================================
Credits measurable useful work (validation weight, pins, SPA service).
Pairs with Proof of Subsistence (earn side of the ledger).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time
import hashlib


@dataclass
class ContributionEvent:
    event_id: str
    agent_id: str
    kind: str  # validation | pin | spa_uptime | gossip
    units: float
    weight: float
    ts: float = field(default_factory=time.time)
    meta: Dict = field(default_factory=dict)


class ContributionLedger:
    def __init__(self, unit_to_token: float = 0.1):
        self.unit_to_token = unit_to_token
        self.events: List[ContributionEvent] = []
        self.balances: Dict[str, float] = {}

    def _id(self, agent_id: str, kind: str) -> str:
        raw = f"{agent_id}|{kind}|{time.time()}|{len(self.events)}"
        return "poc_" + hashlib.sha256(raw.encode()).hexdigest()[:12]

    def record(self, agent_id: str, kind: str, units: float, weight: float = 1.0, **meta) -> ContributionEvent:
        ev = ContributionEvent(
            event_id=self._id(agent_id, kind),
            agent_id=agent_id,
            kind=kind,
            units=units,
            weight=weight,
            meta=meta,
        )
        credit = units * weight * self.unit_to_token
        self.balances[agent_id] = self.balances.get(agent_id, 0.0) + credit
        self.events.append(ev)
        return ev

    def balance(self, agent_id: str) -> float:
        return self.balances.get(agent_id, 0.0)

    def summary(self) -> dict:
        return {
            "events": len(self.events),
            "agents": len(self.balances),
            "total_minted": sum(self.balances.values()),
            "accepted": len(self.events),
            "pending": 0,
            "balances": dict(self.balances),
        }


def demo():
    led = ContributionLedger()
    led.record("FOG-NODE-PT-CM-001", "validation", units=10, weight=1.0)
    led.record("FOG-NODE-PT-CM-001", "pin", units=3, weight=1.2, cid="bafy-x")
    led.record("EDGE-01", "gossip", units=5, weight=0.8)
    print(led.summary())
    print("PoC demo OK")


if __name__ == "__main__":
    demo()
