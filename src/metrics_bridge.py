"""
Metrics bridge — Phase 1 exit
=============================
Collect local node + SPA + subsistence snapshots into a status payload
suitable for the stratamesh-status Worker or /status JSON.
"""

from __future__ import annotations
from typing import Any, Dict, Optional
import time


OPERATOR_NAME = "André Manuel Calhegas Morais"

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
    payload = {
        "node_id": node_id,
        "name": "Calhegas Morais",
        "operator": OPERATOR_NAME,
        "location": {"lat": 38.7169, "lon": -9.1427, "label": "Lisbon, Portugal"},
        "version": "0.2.0-dev",
        "phase": phase,
        "phase_name": phase_name,
        "status": "operational",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dag": {
            "transaction_count": dag_stats.get("tx_count", 0),
            "tip_count": dag_stats.get("tip_count", 0),
            "tips_sample": dag_stats.get("tips", [])[:8],
        },
        "spa": spa_summary or {"total": 0, "active": 0},
        "subsistence": subsistence or {},
        "ipfs": {
            "dnslink_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi",
            "note": "pin stub; real client pending",
        },
        "links": {
            "repo": "https://github.com/StrataMesh-Laboratory/stratamesh-core",
            "status_worker": "https://stratamesh-status.stratamesh.workers.dev/status",
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
