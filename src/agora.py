"""
Strata Agora — Phase 3 scaffold
===============================
Minimal order book for STRATA ↔ service credits (lab only).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum
import time
import hashlib


class Side(Enum):
    BUY = "buy"
    SELL = "sell"


@dataclass
class Order:
    order_id: str
    agent_id: str
    side: Side
    amount: float
    price: float  # quote per STRATA
    filled: float = 0.0
    active: bool = True
    ts: float = field(default_factory=time.time)

    @property
    def remaining(self) -> float:
        return max(0.0, self.amount - self.filled)


@dataclass
class Trade:
    trade_id: str
    buy_order: str
    sell_order: str
    amount: float
    price: float
    ts: float = field(default_factory=time.time)


class Agora:
    def __init__(self, token_ledger=None):
        self.orders: Dict[str, Order] = {}
        self.trades: List[Trade] = []
        self.token_ledger = token_ledger  # optional StrataTokenLedger
        self.settlement_log: List[dict] = []

    def _oid(self, agent_id: str, side: str) -> str:
        raw = f"{agent_id}|{side}|{time.time()}|{len(self.orders)}"
        return "ord_" + hashlib.sha256(raw.encode()).hexdigest()[:12]

    def place(self, agent_id: str, side: str, amount: float, price: float) -> Order:
        if amount <= 0 or price <= 0:
            raise ValueError("amount and price must be positive")
        s = Side.BUY if side.lower() == "buy" else Side.SELL
        o = Order(
            order_id=self._oid(agent_id, s.value),
            agent_id=agent_id,
            side=s,
            amount=amount,
            price=price,
        )
        self.orders[o.order_id] = o
        self._match()
        return o

    def _match(self):
        buys = sorted(
            [o for o in self.orders.values() if o.active and o.side == Side.BUY and o.remaining > 0],
            key=lambda x: (-x.price, x.ts),
        )
        sells = sorted(
            [o for o in self.orders.values() if o.active and o.side == Side.SELL and o.remaining > 0],
            key=lambda x: (x.price, x.ts),
        )
        i = j = 0
        while i < len(buys) and j < len(sells):
            b, s = buys[i], sells[j]
            if b.price < s.price:
                break
            qty = min(b.remaining, s.remaining)
            px = s.price  # maker sell price
            # Settlement: seller must hold STRATA; buyer receives STRATA (lab: no external quote asset)
            if self.token_ledger is not None:
                seller = s.agent_id
                buyer = b.agent_id
                if self.token_ledger.balance(seller) < qty:
                    # skip this sell order until funded
                    s.active = False
                    j += 1
                    continue
                ok = self.token_ledger.transfer(seller, buyer, qty)
                if not ok:
                    s.active = False
                    j += 1
                    continue
                self.settlement_log.append({
                    "buyer": buyer, "seller": seller, "amount": qty, "price": px
                })
            tid = "tr_" + hashlib.sha256(f"{b.order_id}|{s.order_id}|{time.time()}".encode()).hexdigest()[:10]
            self.trades.append(Trade(tid, b.order_id, s.order_id, qty, px))
            b.filled += qty
            s.filled += qty
            if b.remaining <= 1e-12:
                b.active = False
                i += 1
            if s.remaining <= 1e-12:
                s.active = False
                j += 1

    def book(self) -> dict:
        return {
            "bids": [
                {"id": o.order_id, "agent": o.agent_id, "amount": o.remaining, "price": o.price}
                for o in sorted(
                    [o for o in self.orders.values() if o.active and o.side == Side.BUY],
                    key=lambda x: -x.price,
                )[:20]
            ],
            "asks": [
                {"id": o.order_id, "agent": o.agent_id, "amount": o.remaining, "price": o.price}
                for o in sorted(
                    [o for o in self.orders.values() if o.active and o.side == Side.SELL],
                    key=lambda x: x.price,
                )[:20]
            ],
            "trades": len(self.trades),
            "last_price": self.trades[-1].price if self.trades else None,
            "settlements": len(self.settlement_log),
        }


def demo():
    a = Agora()
    a.place("FOG-NODE-PT-CM-001", "sell", 10, 1.0)
    a.place("EDGE-01", "buy", 4, 1.05)
    a.place("EDGE-02", "buy", 10, 0.9)
    print(a.book())
    print("trades", [(t.amount, t.price) for t in a.trades])
    print("agora demo OK")


if __name__ == "__main__":
    demo()
