"""
Subsistence ledger — per-agent reserve and solvency state.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time
from .meter import ResourceMeter, ResourceVector


@dataclass
class AgentAccount:
    agent_id: str
    reserve: float = 0.0
    tau: float = 0.0                 # solvency threshold
    grace_remaining: int = 0         # ticks of insolvency allowed
    status: str = "active"           # active | hibernating | migrating | evolving | exited
    last_surplus: float = 0.0
    meter: ResourceMeter = field(default=None)  # type: ignore

    def __post_init__(self):
        if self.meter is None:
            self.meter = ResourceMeter(agent_id=self.agent_id)

    def surplus(self, weights: Dict[str, float] | None = None) -> float:
        snap = self.meter.snapshot(weights)
        s = snap["earned_total"] + self.reserve - snap["consumed_total"]
        self.last_surplus = s
        return s

    def is_solvent(self, weights: Dict[str, float] | None = None) -> bool:
        return self.surplus(weights) >= self.tau


@dataclass
class LedgerEntry:
    agent_id: str
    kind: str  # consume | earn | reserve_adjust | status
    amount: float
    detail: dict
    ts: float = field(default_factory=time.time)


class SubsistenceLedger:
    def __init__(self, weights: Dict[str, float] | None = None):
        self.accounts: Dict[str, AgentAccount] = {}
        self.log: List[LedgerEntry] = []
        self.weights = weights

    def ensure(self, agent_id: str, **kwargs) -> AgentAccount:
        if agent_id not in self.accounts:
            self.accounts[agent_id] = AgentAccount(agent_id=agent_id, **kwargs)
            self.log.append(LedgerEntry(agent_id, "status", 0.0, {"status": "created"}))
        return self.accounts[agent_id]

    def consume(self, agent_id: str, **resources):
        acc = self.ensure(agent_id)
        acc.meter.record_consume(**resources)
        total = ResourceVector(**resources).total(self.weights)
        self.log.append(LedgerEntry(agent_id, "consume", total, resources))

    def earn(self, agent_id: str, **resources):
        acc = self.ensure(agent_id)
        acc.meter.record_earn(**resources)
        total = ResourceVector(**resources).total(self.weights)
        self.log.append(LedgerEntry(agent_id, "earn", total, resources))

    def adjust_reserve(self, agent_id: str, delta: float, reason: str = ""):
        acc = self.ensure(agent_id)
        acc.reserve += delta
        self.log.append(LedgerEntry(agent_id, "reserve_adjust", delta, {"reason": reason}))

    def settle_window(self, agent_id: str) -> dict:
        """
        Fold window earnings − consumption into reserve; reset meter window.
        Returns solvency report.
        """
        acc = self.ensure(agent_id)
        snap = acc.meter.snapshot(self.weights)
        net = snap["earned_total"] - snap["consumed_total"]
        acc.reserve += net
        surplus = acc.reserve - acc.tau
        acc.last_surplus = surplus
        acc.meter.reset_window()
        self.log.append(LedgerEntry(agent_id, "settle", net, {
            "reserve": acc.reserve,
            "surplus": surplus,
            "solvent": surplus >= 0,
        }))
        return {
            "agent_id": agent_id,
            "net": net,
            "reserve": acc.reserve,
            "surplus": surplus,
            "solvent": surplus >= 0,
            "status": acc.status,
        }

    def report(self, agent_id: str) -> dict:
        acc = self.ensure(agent_id)
        s = acc.surplus(self.weights)
        snap = acc.meter.snapshot(self.weights)
        consumed = float(snap.get("consumed_total") or 0)
        earned = float(snap.get("earned_total") or 0)
        denom = max(earned + float(acc.reserve or 0), 1e-9)
        return {
            "agent_id": agent_id,
            "reserve": acc.reserve,
            "surplus": s,
            "tau": acc.tau,
            "solvent": s >= acc.tau,
            "status": acc.status,
            "pressure": round(consumed / denom, 6),
            "debt": round(max(0.0, float(acc.tau or 0) - s), 6),
            "meter": snap,
        }
