"""
Meta-finality modules — Track B2
================================
Pluggable deterministic finality on top of probabilistic tip confidence.
Lab reference: threshold cumulative-weight finality.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import time


@dataclass
class FinalityVerdict:
    tx_id: str
    module: str
    finalized: bool
    confidence: float
    reason: str
    ts: float = field(default_factory=time.time)
    meta: Dict[str, Any] = field(default_factory=dict)


class FinalityModule(ABC):
    name: str = "base"

    @abstractmethod
    def evaluate(self, tx_id: str, dag, tip_report: list) -> FinalityVerdict:
        ...

    def evaluate_tips(self, dag, tip_report: list) -> List[FinalityVerdict]:
        return [self.evaluate(t["tx_id"], dag, tip_report) for t in tip_report]


class ProbabilisticPassthrough(FinalityModule):
    """Default: expose tip confidence without deterministic claim."""

    name = "probabilistic"

    def evaluate(self, tx_id: str, dag, tip_report: list) -> FinalityVerdict:
        conf = 0.0
        for t in tip_report:
            if t.get("tx_id") == tx_id:
                conf = float(t.get("confidence") or 0)
                break
        return FinalityVerdict(
            tx_id=tx_id,
            module=self.name,
            finalized=False,
            confidence=conf,
            reason="probabilistic tip confidence only; not deterministic",
        )


class CumulativeWeightThreshold(FinalityModule):
    """
    Lab deterministic rule: tip is finalized if cumulative_weight >= threshold
    and confidence >= min_confidence.
    """

    name = "cw_threshold"

    def __init__(self, threshold: float = 3.0, min_confidence: float = 0.2):
        self.threshold = threshold
        self.min_confidence = min_confidence

    def evaluate(self, tx_id: str, dag, tip_report: list) -> FinalityVerdict:
        conf = 0.0
        cw = 0.0
        for t in tip_report:
            if t.get("tx_id") == tx_id:
                conf = float(t.get("confidence") or 0)
                cw = float(t.get("cumulative_weight") or 0)
                break
        # also peek dag if available
        if hasattr(dag, "txs") and tx_id in dag.txs:
            cw = max(cw, float(getattr(dag.txs[tx_id], "cumulative_weight", 0) or 0))
        ok = cw >= self.threshold and conf >= self.min_confidence
        return FinalityVerdict(
            tx_id=tx_id,
            module=self.name,
            finalized=ok,
            confidence=conf,
            reason=(
                f"cw={cw} threshold={self.threshold}; conf={conf} min={self.min_confidence}"
            ),
            meta={"cumulative_weight": cw, "threshold": self.threshold},
        )


class FinalityEngine:
    """Runs one or more modules; primary module drives /finality/modules output."""

    def __init__(self, modules: Optional[List[FinalityModule]] = None):
        self.modules: List[FinalityModule] = modules or [
            ProbabilisticPassthrough(),
            CumulativeWeightThreshold(),
        ]

    def run(self, dag, tip_report: list) -> dict:
        by_module: Dict[str, List[dict]] = {}
        for mod in self.modules:
            verdicts = mod.evaluate_tips(dag, tip_report)
            by_module[mod.name] = [
                {
                    "tx_id": v.tx_id,
                    "finalized": v.finalized,
                    "confidence": v.confidence,
                    "reason": v.reason,
                    "meta": v.meta,
                }
                for v in verdicts
            ]
        finalized = [
            v["tx_id"]
            for name, vs in by_module.items()
            if name != "probabilistic"
            for v in vs
            if v["finalized"]
        ]
        return {
            "modules": [m.name for m in self.modules],
            "by_module": by_module,
            "finalized_tx_ids": sorted(set(finalized)),
        }


def demo():
    from tip_selection import DAG, Transaction, TxType

    dag = DAG()
    dag.bootstrap()
    for i in range(5):
        parents = dag.select_tips(k=2) or ["genesis"]
        tx = Transaction(
            tx_id=Transaction.make_id(f"t{i}", str(time.time())),
            tx_type=TxType.STANDARD,
            parents=parents,
            weight=1.0,
        )
        dag.attach(tx)
    from finality import tip_set_report

    report = tip_set_report(dag, limit=10)
    eng = FinalityEngine()
    out = eng.run(dag, report)
    print(out)
    print("finality_modules demo OK")


if __name__ == "__main__":
    demo()
