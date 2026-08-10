"""
Autonomous Computational Beings (ACB) — Phase 6 scaffold
========================================================
Registry + heartbeat + PoSbs coupling. Substrate-neutral agents.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum
import time
import hashlib
from resource_meter import sample as resource_sample, estimate_consume


class ACBState(Enum):
    ACTIVE = "active"
    HIBERNATING = "hibernating"
    MIGRATING = "migrating"
    EVOLVING = "evolving"
    EXITED = "exited"


@dataclass
class ACB:
    acb_id: str
    controller: str  # operator or self
    label: str = ""
    state: ACBState = ACBState.ACTIVE
    created_at: float = field(default_factory=time.time)
    last_heartbeat: float = field(default_factory=time.time)
    capabilities: List[str] = field(default_factory=list)
    dag_tx: Optional[str] = None


class ACBRegistry:
    def __init__(self, subsistence_runtime=None, contribution_ledger=None):
        self.acbs: Dict[str, ACB] = {}
        self.subsistence = subsistence_runtime
        self.poc = contribution_ledger

    def _id(self, controller: str, label: str) -> str:
        raw = f"{controller}|{label}|{time.time()}"
        return "acb_" + hashlib.sha256(raw.encode()).hexdigest()[:14]

    def register(
        self,
        controller: str,
        label: str = "",
        capabilities: Optional[List[str]] = None,
        reserve: float = 5.0,
    ) -> ACB:
        acb = ACB(
            acb_id=self._id(controller, label or "acb"),
            controller=controller,
            label=label or "ACB",
            capabilities=capabilities or ["compute"],
        )
        self.acbs[acb.acb_id] = acb
        if self.subsistence:
            self.subsistence.register(acb.acb_id, reserve=reserve, tau=0.0)
        return acb

    def heartbeat(
        self,
        acb_id: str,
        consume: float | None = None,
        earn: float = 0.0,
        auto_meter: bool = True,
    ) -> dict:
        acb = self.acbs[acb_id]
        if acb.state == ACBState.EXITED:
            raise ValueError("ACB exited")
        acb.last_heartbeat = time.time()
        report = {"acb_id": acb_id, "state": acb.state.value}
        meter = None
        if auto_meter and consume is None:
            meter = resource_sample()
            consume = estimate_consume(meter)
            report["meter"] = {
                "cpu_percent": meter.cpu_percent,
                "mem_rss_mb": round(meter.mem_rss_mb, 2),
                "source": meter.source,
                "consume_est": consume,
            }
        elif consume is None:
            consume = 0.5
        if self.subsistence:
            if consume > 0:
                self.subsistence.consume(acb_id, compute=consume)
            if earn > 0:
                self.subsistence.earn(acb_id, compute=earn)
                if self.poc:
                    self.poc.record(acb_id, "acb_work", units=earn)
            ticks = self.subsistence.tick([acb_id])
            if ticks:
                t = ticks[0]
                report.update({
                    "surplus": t.get("surplus"),
                    "solvent": t.get("solvent"),
                    "action": t.get("action"),
                    "status": t.get("status"),
                })
                action = t.get("action")
                if action == "hibernate":
                    acb.state = ACBState.HIBERNATING
                elif action == "migrate":
                    acb.state = ACBState.MIGRATING
                elif action == "evolve":
                    acb.state = ACBState.EVOLVING
                elif action == "exit":
                    acb.state = ACBState.EXITED
                elif action in ("none", "optimize") and acb.state != ACBState.EXITED:
                    if t.get("solvent"):
                        acb.state = ACBState.ACTIVE
                report["state"] = acb.state.value
        return report

    def summary(self) -> dict:
        by_state: Dict[str, int] = {}
        for a in self.acbs.values():
            by_state[a.state.value] = by_state.get(a.state.value, 0) + 1
        return {
            "total": len(self.acbs),
            "by_state": by_state,
            "acbs": [
                {
                    "acb_id": a.acb_id,
                    "controller": a.controller,
                    "label": a.label,
                    "state": a.state.value,
                    "capabilities": a.capabilities,
                    "dag_tx": a.dag_tx,
                    "last_heartbeat": a.last_heartbeat,
                }
                for a in list(self.acbs.values())[-40:]
            ],
        }


def demo():
    from subsistence.runtime import SubsistenceRuntime
    from contribution import ContributionLedger
    rt = SubsistenceRuntime()
    poc = ContributionLedger()
    reg = ACBRegistry(rt, poc)
    a = reg.register("FOG-NODE-PT-CM-001", "Analyst-1", ["analysis", "compute"], reserve=2.0)
    print(reg.heartbeat(a.acb_id, consume=1.0, earn=0.2))
    print(reg.heartbeat(a.acb_id, consume=3.0, earn=0.1))
    print(reg.summary())
    print("acb demo OK")


if __name__ == "__main__":
    demo()
