"""
Metrics bridge — Phase 1 exit
=============================
Collect local node + SPA + subsistence snapshots into a status payload
suitable for the stratamesh-status Worker or /status JSON.
"""

from __future__ import annotations
from typing import Any, Dict, Optional
import time

from host_fingerprint import fingerprint as host_fingerprint


OPERATOR_NAME = "André Manuel Calhegas Morais"


def _honest_dag(dag_stats: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Always emit numeric transaction_count. Empty ledger is 0 + source=empty, not null."""
    d = dag_stats if isinstance(dag_stats, dict) else {}
    tx = d.get("transaction_count", d.get("tx_count", 0))
    try:
        tx_n = int(tx)
    except (TypeError, ValueError):
        tx_n = 0
    tips = d.get("tip_count", d.get("tips"))
    if isinstance(tips, list):
        tip_n = len(tips)
        sample = tips[:8]
    else:
        try:
            tip_n = int(tips or 0)
        except (TypeError, ValueError):
            tip_n = 0
        sample = list(d.get("tips_sample") or d.get("tips") or [])[:8]
    height = d.get("height", d.get("max_height", 0))
    try:
        height_n = int(height or 0)
    except (TypeError, ValueError):
        height_n = 0
    return {
        "transaction_count": tx_n,
        "tip_count": tip_n,
        "height": height_n,
        "max_height": int(d.get("max_height") or height_n or 0),
        "tips_sample": sample if isinstance(sample, list) else [],
        "source": "ledger" if tx_n else "empty",
        "measured": True,
        "seed_only": False,
    }


def _honest_spa(spa_summary: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Always emit numeric spa.total. Missing registry is 0 + source=empty, not null."""
    s = spa_summary if isinstance(spa_summary, dict) else {}
    try:
        total = int(s.get("total") if s.get("total") is not None else 0)
    except (TypeError, ValueError):
        total = 0
    try:
        active = int(s.get("active") if s.get("active") is not None else 0)
    except (TypeError, ValueError):
        active = 0
    roles = s.get("by_role") if isinstance(s.get("by_role"), dict) else {}
    return {
        "total": total,
        "active": active,
        "by_role": {str(k): int(v or 0) for k, v in roles.items()},
        "opt_out_pending": list(s.get("opt_out_pending") or []),
        "source": str(s.get("source") or ("registry" if total else "empty")),
        "measured": True,
        "seed_only": False,
    }


def build_status_payload(
    *,
    node_id: str = "FOG-NODE-PT-CM-001",
    dag_stats: Optional[Dict[str, Any]] = None,
    spa_summary: Optional[Dict[str, Any]] = None,
    subsistence: Optional[Dict[str, Any]] = None,
    phase: str = "1",
    phase_name: str = "Core DAG + IPFS Linkage",
    extra: Optional[Dict[str, Any]] = None,
) -> dict:
    dag_stats = dag_stats or {}
    fp = host_fingerprint()
    payload = {
        "node_id": node_id,
        "name": "Calhegas Morais",
        "operator": OPERATOR_NAME,
        "location": {"lat": 38.7169, "lon": -9.1427, "label": "Lisbon, Portugal"},
        "version": "0.2.0-dev",
        "host_id": fp["host_id"],
        "host_id_source": fp["source"],
        "phase": phase,
        "phase_name": phase_name,
        "status": "operational",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dag": _honest_dag(dag_stats),
        "spa": _honest_spa(spa_summary),
        "subsistence": subsistence or {},
        "ipfs": {
            "dnslink_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi",
            "note": "pin stub; real client pending",
        },
        "links": {
            "repo": "https://github.com/StrataMesh-Laboratory/stratamesh-core",
            "status_worker": "https://status.calhegasmorais.pt/status",
            "portal": "https://calhegasmorais.pt/dashboard",
        },
        "progress": {
            "phase0": "complete",
            "phase1_scaffold": "complete",
            "phase2_spa_registry": "scaffolded",
            "orchestrator_hybrid": "live",
            "proof_of_subsistence": "live",
            "epistemic_ontology": "normative",
        },
    }
    if extra:
        payload.update(extra)
    sub = payload.get("subsistence")
    if isinstance(sub, dict):
        surplus = float(sub.get("surplus") or 0)
        reserve = float(sub.get("reserve") or 0)
        tau = float(sub.get("tau") or 0)
        meter = sub.get("meter") if isinstance(sub.get("meter"), dict) else {}
        consumed = float(meter.get("consumed_total") or 0)
        earned = float(meter.get("earned_total") or 0)
        denom = max(earned + reserve, 1e-9)
        sub.setdefault("pressure", round(consumed / denom, 6))
        sub.setdefault("debt", round(max(0.0, tau - surplus), 6))
        payload["subsistence"] = sub

    # host_id is computed in-process; do not allow extra to drop it.
    if not payload.get("host_id"):
        payload["host_id"] = fp["host_id"]
        payload["host_id_source"] = fp["source"]
    return payload


def demo():
    from tip_selection import DAG
    from spa_registry import SPARegistry
    from subsistence.runtime import SubsistenceRuntime

    dag = DAG()
    dag.bootstrap()
    reg = SPARegistry(dag)
    reg.register("FOG-NODE-PT-CM-001", ["fog"])
    rt = SubsistenceRuntime()
    rt.register("FOG-NODE-PT-CM-001", reserve=10.0)
    rt.consume("FOG-NODE-PT-CM-001", compute=1.0)
    rt.earn("FOG-NODE-PT-CM-001", compute=2.0)
    settle = rt.tick(["FOG-NODE-PT-CM-001"])[0]

    payload = build_status_payload(
        dag_stats=dag.stats(),
        spa_summary=reg.summary(),
        subsistence=settle,
        phase="2",
        phase_name="Nodal Hierarchy & SPAs (scaffold)",
    )
    import json
    print(json.dumps(payload, indent=2))
    print("metrics_bridge OK")


if __name__ == "__main__":
    demo()
