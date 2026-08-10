"""
Service credit ledger — Track B1
================================
Lab unit SVC used as quote asset against STRATA on Agora.
"""

from __future__ import annotations
from typing import Dict


class ServiceCreditLedger:
    def __init__(self, symbol: str = "SVC"):
        self.symbol = symbol
        self.balances: Dict[str, float] = {}

    def credit(self, agent_id: str, amount: float) -> float:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.balances[agent_id] = self.balances.get(agent_id, 0.0) + amount
        return self.balances[agent_id]

    def balance(self, agent_id: str) -> float:
        return self.balances.get(agent_id, 0.0)

    def transfer(self, frm: str, to: str, amount: float) -> bool:
        if amount <= 0 or self.balances.get(frm, 0.0) < amount:
            return False
        self.balances[frm] -= amount
        self.balances[to] = self.balances.get(to, 0.0) + amount
        return True

    def summary(self) -> dict:
        return {
            "symbol": self.symbol,
            "balances": dict(self.balances),
            "holders": len([b for b in self.balances.values() if b > 0]),
        }
