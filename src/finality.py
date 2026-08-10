"""
Probabilistic finality confidence — Phase 2
===========================================
Confidence ≈ cumulative_weight(tx) / max_cumulative_weight(recent tips cone).
Not deterministic finality; meta-layer modules can sit on top later.
"""

from __future__ import annotations
from typing import Dict, List, Optional
from tip_selection import DAG


def tip_confidence(dag: DAG, tx_id: str) -> float:
    """Return [0, 1] confidence for a transaction."""
    if tx_id not in dag.txs:
        return 0.0
    cw = dag.txs[tx_id].cumulative_weight
    # Reference: max cumulative weight among tips (or all txs)
    ref_pool = list(dag.tips) if dag.tips else list(dag.txs.keys())
    if not ref_pool:
        return 0.0
    max_cw = max(dag.txs[t].cumulative_weight for t in ref_pool if t in dag.txs)
    if max_cw <= 0:
        return 0.0
    # Also consider global max for older txs
    global_max = max(tx.cumulative_weight for tx in dag.txs.values())
    denom = max(max_cw, global_max, 1e-9)
    return max(0.0, min(1.0, cw / denom))


def tip_set_report(dag: DAG, limit: int = 16) -> List[dict]:
    tips = list(dag.tips)[:limit]
    return [
        {
            "tx_id": tid,
            "confidence": round(tip_confidence(dag, tid), 4),
            "cumulative_weight": dag.txs[tid].cumulative_weight if tid in dag.txs else 0,
            "type": dag.txs[tid].tx_type.value if tid in dag.txs else None,
        }
        for tid in tips
    ]


def deep_confidence(dag: DAG, tx_id: str, threshold: float = 0.8) -> bool:
    return tip_confidence(dag, tx_id) >= threshold
