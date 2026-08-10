"""
SubsistenceRuntime — tick loop binding meter, ledger, and policy.
Optional hook into Orchestrator bilateral bus later.
"""

from __future__ import annotations
from typing import Dict, List, Optional, Callable
from .ledger import SubsistenceLedger
from .policy import SubsistencePolicy, PressureAction


class SubsistenceRuntime:
    def __init__(
        self,
        ledger: Optional[SubsistenceLedger] = None,
        policy: Optional[SubsistencePolicy] = None,
        on_pressure: Optional[Callable[[str, PressureAction], None]] = None,
    ):
        self.ledger = ledger or SubsistenceLedger()
        self.policy = policy or SubsistencePolicy()
        self.on_pressure = on_pressure
        self.tick_id = 0

    def register(self, agent_id: str, reserve: float = 0.0, tau: float = 0.0):
        acc = self.ledger.ensure(agent_id, reserve=reserve, tau=tau)
        acc.grace_remaining = self.policy.max_grace_ticks
        return acc

    def consume(self, agent_id: str, **resources):
        self.ledger.consume(agent_id, **resources)

    def earn(self, agent_id: str, **resources):
        self.ledger.earn(agent_id, **resources)

    def tick(self, agent_ids: Optional[List[str]] = None) -> List[dict]:
        """
        Settle windows and apply pressure policy for each agent.
        """
        self.tick_id += 1
        ids = agent_ids or list(self.ledger.accounts.keys())
        reports = []
        for aid in ids:
            settle = self.ledger.settle_window(aid)
            acc = self.ledger.accounts[aid]
            # last_surplus already set relative to reserve after settle
            acc.last_surplus = acc.reserve - acc.tau
            action = self.policy.recommend(acc)
            prev = acc.status
            self.policy.apply_status(acc, action)
            if self.on_pressure and action != PressureAction.NONE:
                self.on_pressure(aid, action)
            reports.append({
                "tick": self.tick_id,
                "agent_id": aid,
                "reserve": acc.reserve,
                "surplus": acc.last_surplus,
                "solvent": acc.last_surplus >= 0,
                "action": action.value,
                "status": acc.status,
                "status_changed": prev != acc.status,
            })
        return reports


def demo():
    events = []

    def on_pressure(agent_id: str, action: PressureAction):
        events.append((agent_id, action.value))

    rt = SubsistenceRuntime(on_pressure=on_pressure)
    rt.register("ACB-001", reserve=5.0, tau=0.0)
    rt.register("FOG-OP-7", reserve=20.0, tau=0.0)

    print("=== Proof of Subsistence demo ===\n")

    # Healthy contributor
    rt.consume("FOG-OP-7", compute=2.0, energy=1.0)
    rt.earn("FOG-OP-7", compute=5.0)  # contribution credit
    # ACB burns more than it earns
    rt.consume("ACB-001", compute=8.0, memory_time=3.0, energy=2.0)
    rt.earn("ACB-001", compute=1.0)

    for label in ["settle #1", "settle #2 (continued deficit)", "settle #3"]:
        if "2" in label or "3" in label:
            rt.consume("ACB-001", compute=6.0, memory_time=2.0)
            rt.earn("ACB-001", compute=0.5)
            rt.consume("FOG-OP-7", compute=1.0)
            rt.earn("FOG-OP-7", compute=3.0)
        reports = rt.tick()
        print(f"-- {label} --")
        for r in reports:
            print(
                f"  {r['agent_id']}: reserve={r['reserve']:.1f} surplus={r['surplus']:.1f} "
                f"action={r['action']} status={r['status']}"
            )
        print()

    print("Pressure events:", events)
    print("PoSbs demo OK.")


if __name__ == "__main__":
    demo()
