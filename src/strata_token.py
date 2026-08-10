"""
Strata Token — Phase 3 scaffold
===============================
Mint path from Proof of Contribution credits.
Not a mainnet issuance; lab accounting unit "STRATA".
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time
import hashlib


@dataclass
class MintEvent:
    mint_id: str
    agent_id: str
    amount: float
    source: str  # poc | genesis | transfer
    ref: Optional[str] = None
    ts: float = field(default_factory=time.time)


class StrataTokenLedger:
    def __init__(self, symbol: str = "STRATA"):
        self.symbol = symbol
        self.balances: Dict[str, float] = {}
        self.mints: List[MintEvent] = []
        self.total_supply: float = 0.0

    def _id(self, agent_id: str, amount: float) -> str:
        raw = f"{agent_id}|{amount}|{time.time()}|{len(self.mints)}"
        return "mint_" + hashlib.sha256(raw.encode()).hexdigest()[:12]

    def mint_from_poc(self, agent_id: str, poc_credit: float, rate: float = 1.0, ref: str = "") -> MintEvent:
        """Convert PoC ledger credit into STRATA at rate (default 1:1)."""
        amount = max(0.0, poc_credit * rate)
        if amount <= 0:
            raise ValueError("nothing to mint")
        ev = MintEvent(
            mint_id=self._id(agent_id, amount),
            agent_id=agent_id,
            amount=amount,
            source="poc",
            ref=ref or "poc_credit",
        )
        self.balances[agent_id] = self.balances.get(agent_id, 0.0) + amount
        self.total_supply += amount
        self.mints.append(ev)
        return ev

    def transfer(self, frm: str, to: str, amount: float) -> bool:
        if amount <= 0 or self.balances.get(frm, 0.0) < amount:
            return False
        self.balances[frm] -= amount
        self.balances[to] = self.balances.get(to, 0.0) + amount
        return True

    def balance(self, agent_id: str) -> float:
        return self.balances.get(agent_id, 0.0)

    def summary(self) -> dict:
        return {
            "symbol": self.symbol,
            "total_supply": self.total_supply,
            "holders": len([b for b in self.balances.values() if b > 0]),
            "balances": dict(self.balances),
            "mint_events": len(self.mints),
        }


def demo():
    from contribution import ContributionLedger
    poc = ContributionLedger()
    poc.record("FOG-NODE-PT-CM-001", "validation", 10)
    poc.record("FOG-NODE-PT-CM-001", "pin", 5, weight=1.2)
    tok = StrataTokenLedger()
    credit = poc.balance("FOG-NODE-PT-CM-001")
    ev = tok.mint_from_poc("FOG-NODE-PT-CM-001", credit, rate=1.0)
    print(ev)
    print(tok.summary())
    print("token demo OK")


if __name__ == "__main__":
    demo()
