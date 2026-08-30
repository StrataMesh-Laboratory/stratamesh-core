"""
StrataMesh Tip Selection — Reference Implementation v0.1
=======================================================
Open-source, readable reference. Not yet formally verified.
Designed for community review and later formalisation.

Key properties (whitepaper-aligned):
- New transactions approve one or more tips.
- Confirmation strength grows with cumulative weight of the future cone.
- Lightweight transactions receive preferential treatment in selection
  and carry lower intrinsic weight (suitable for IoT / micro-payments).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Tuple
from enum import Enum
import random
import time
import hashlib


class TxType(Enum):
    STANDARD = "standard"
    LIGHTWEIGHT = "lightweight"
    SPA = "spa"
    FINALITY = "finality"
    MINT = "mint"
    TRADE = "trade"
    ACCOUNT = "account"  # registered wallet open — not a mint
    BURN = "burn"        # wallet → #0


@dataclass
class Transaction:
    tx_id: str
    tx_type: TxType
    parents: List[str]
    weight: float = 1.0
    cumulative_weight: float = 1.0
    timestamp: float = field(default_factory=time.time)
    cid: Optional[str] = None
    sender: Optional[str] = None

    @staticmethod
    def make_id(*parts: str) -> str:
        h = hashlib.sha256("||".join(parts).encode()).hexdigest()
        return h[:16]


@dataclass
class DAG:
    tips: Set[str] = field(default_factory=set)
    txs: Dict[str, Transaction] = field(default_factory=dict)
    genesis_id: Optional[str] = None

    def bootstrap(self) -> str:
        """Create a genesis transaction if the DAG is empty."""
        if self.txs:
            return self.genesis_id  # type: ignore
        g = Transaction(
            tx_id="genesis",
            tx_type=TxType.STANDARD,
            parents=[],
            weight=1.0,
            cumulative_weight=1.0,
        )
        self.txs[g.tx_id] = g
        self.tips.add(g.tx_id)
        self.genesis_id = g.tx_id
        return g.tx_id

    def select_tips(self, k: int = 2, prefer_lightweight_bias: float = 0.35) -> List[str]:
        """
        Simple weighted tip selection.
        - Higher cumulative weight → higher selection probability.
        - Small bias toward tips that are themselves LIGHTWEIGHT
          (encourages fast confirmation of micro-transactions).
        """
        if not self.tips:
            return []

        candidates = list(self.tips)
        weights = []
        for tid in candidates:
            tx = self.txs[tid]
            w = max(tx.cumulative_weight, 0.01)
            if tx.tx_type == TxType.LIGHTWEIGHT:
                w *= (1.0 + prefer_lightweight_bias)
            weights.append(w)

        total = sum(weights)
        probs = [w / total for w in weights]

        # Sample without replacement
        selected = []
        remaining = list(zip(candidates, probs))
        for _ in range(min(k, len(remaining))):
            r = random.random()
            cum = 0.0
            for i, (tid, p) in enumerate(remaining):
                cum += p
                if r <= cum:
                    selected.append(tid)
                    remaining.pop(i)
                    # renormalise
                    s = sum(p for _, p in remaining) or 1.0
                    remaining = [(t, p / s) for t, p in remaining]
                    break
        return selected

    def attach(self, tx: Transaction) -> bool:
        if tx.tx_id in self.txs:
            return False
        if not self.txs:
            self.bootstrap()

        for p in tx.parents:
            if p not in self.txs:
                return False

        if tx.tx_type == TxType.LIGHTWEIGHT:
            tx.weight = min(tx.weight, 0.15)

        self.txs[tx.tx_id] = tx
        for p in tx.parents:
            self.tips.discard(p)
        self.tips.add(tx.tx_id)

        # Very simple cumulative weight update (future cone is approximated)
        # Real implementation needs an efficient reverse-edge index.
        self._update_cumulative(tx.tx_id)
        return True

    def _update_cumulative(self, start_id: str) -> None:
        # Walk backwards and add weight (naive; fine for small test DAGs)
        visited = set()
        stack = [start_id]
        while stack:
            tid = stack.pop()
            if tid in visited:
                continue
            visited.add(tid)
            tx = self.txs[tid]
            for p in tx.parents:
                if p in self.txs:
                    parent = self.txs[p]
                    parent.cumulative_weight += tx.weight
                    stack.append(p)

    def confidence(self, tx_id: str) -> float:
        tx = self.txs.get(tx_id)
        return tx.cumulative_weight if tx else 0.0

    def stats(self) -> Dict:
        return {
            "tx_count": len(self.txs),
            "tip_count": len(self.tips),
            "tips": list(self.tips)[:10],
        }


# ------------------------------------------------------------------
# Minimal self-test / demo
# ------------------------------------------------------------------
if __name__ == "__main__":
    random.seed(42)
    dag = DAG()
    dag.bootstrap()

    print("Genesis created:", dag.genesis_id)
    print("Initial tips:", dag.tips)

    for i in range(12):
        parents = dag.select_tips(k=2 if i % 3 else 1)
        tx_type = TxType.LIGHTWEIGHT if i % 4 == 0 else TxType.STANDARD
        tx = Transaction(
            tx_id=Transaction.make_id(str(i), str(time.time())),
            tx_type=tx_type,
            parents=parents,
            weight=1.0,
            cid=f"bafy-demo-{i}" if i % 5 == 0 else None,
        )
        ok = dag.attach(tx)
        print(f"[{i:02d}] attached={ok} type={tx_type.value:11} parents={parents} id={tx.tx_id}")

    print("\nFinal stats:", dag.stats())
    print("Sample confidences:")
    for tid in list(dag.txs)[:5]:
        print(f"  {tid}: {dag.confidence(tid):.2f}")
