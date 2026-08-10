"""
Strata Agora — Track B1 dual-asset
==================================
Order book: STRATA base ↔ SVC (service credit) quote.
price = SVC per 1 STRATA.

Settlement on match:
  seller → buyer: qty STRATA
  buyer  → seller: qty * price SVC
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
    amount: float  # STRATA
    price: float  # SVC per STRATA
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
    def __init__(self, token_ledger=None, service_ledger=None):
        self.orders: Dict[str, Order] = {}
        self.trades: List[Trade] = []
        self.token_ledger = token_ledger  # STRATA
        self.service_ledger = service_ledger  # SVC
        self.settlement_log: List[dict] = []
        self.market = {"base": "STRATA", "quote": "SVC"}

    def _oid(self, agent_id: str, side: str) -> str:
        raw = f"{agent_id}|{side}|{time.time()}|{len(self.orders)}"
        return "ord_" + hashlib.sha256(raw.encode()).hexdigest()[:12]

    def place(self, agent_id: str, side: str, amount: float, price: float) -> Order:
        if amount <= 0 or price <= 0:
            raise ValueError("amount and price must be positive")
        s = Side.BUY if side.lower() == "buy" else Side.SELL
        # Pre-checks (locks soft: reject if clearly underfunded)
        if self.token_ledger is not None and s == Side.SELL:
            if self.token_ledger.balance(agent_id) < amount:
                raise ValueError("insufficient STRATA to sell")
        if self.service_ledger is not None and s == Side.BUY:
            need = amount * price
            if self.service_ledger.balance(agent_id) < need:
                raise ValueError("insufficient SVC to buy")
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
            px = s.price
            quote = qty * px
            seller, buyer = s.agent_id, b.agent_id

            if self.token_ledger is not None:
                if self.token_ledger.balance(seller) < qty:
                    s.active = False
                    j += 1
                    continue
            if self.service_ledger is not None:
                if self.service_ledger.balance(buyer) < quote:
                    b.active = False
                    i += 1
                    continue

            if self.token_ledger is not None:
                if not self.token_ledger.transfer(seller, buyer, qty):
                    s.active = False
                    j += 1
                    continue
            if self.service_ledger is not None:
                if not self.service_ledger.transfer(buyer, seller, quote):
                    # rollback STRATA if needed
                    if self.token_ledger is not None:
                        self.token_ledger.transfer(buyer, seller, qty)
                    b.active = False
                    i += 1
                    continue

            self.settlement_log.append({
                "buyer": buyer,
                "seller": seller,
                "base_amount": qty,
                "quote_amount": quote,
                "price": px,
                "base": "STRATA",
                "quote": "SVC",
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
            "market": self.market,
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
    from strata_token import StrataTokenLedger
    from service_credit import ServiceCreditLedger

    tok = StrataTokenLedger()
    svc = ServiceCreditLedger()
    tok.mint_from_poc("SELLER", 10.0)
    svc.credit("BUYER", 50.0)
    a = Agora(token_ledger=tok, service_ledger=svc)
    a.place("SELLER", "sell", 4.0, 2.0)  # 2 SVC per STRATA
    a.place("BUYER", "buy", 4.0, 2.5)
    print("seller STRATA", tok.balance("SELLER"), "SVC", svc.balance("SELLER"))
    print("buyer  STRATA", tok.balance("BUYER"), "SVC", svc.balance("BUYER"))
    print(a.book())
    assert abs(tok.balance("BUYER") - 4.0) < 1e-9
    assert abs(svc.balance("SELLER") - 8.0) < 1e-9
    print("agora dual-asset demo OK")


if __name__ == "__main__":
    demo()
