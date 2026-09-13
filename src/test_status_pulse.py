#!/usr/bin/env python3
"""#148/#149 honesty: Fog /status spa.total and dag.transaction_count are numbers.

Never null. Empty ledger/registry is 0 + source=empty (not seed-only six roles).
In-process only. No Workers, no workers.dev.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from metrics_bridge import build_status_payload, _honest_dag, _honest_spa
from spa_registry import SPARegistry


def test_null_inputs_become_numbers():
    p = build_status_payload(dag_stats=None, spa_summary=None)
    assert isinstance(p["dag"]["transaction_count"], int)
    assert isinstance(p["spa"]["total"], int)
    assert p["dag"]["transaction_count"] == 0
    assert p["spa"]["total"] == 0
    assert p["dag"]["source"] == "empty"
    assert p["spa"]["source"] == "empty"
    assert p["spa"]["seed_only"] is False
    json.loads(json.dumps(p))


def test_tx_count_alias_and_registry():
    p = build_status_payload(
        dag_stats={"tx_count": 1237, "tip_count": 1, "height": 1236},
        spa_summary={"total": 6, "active": 6, "by_role": {"atelier": 1}, "source": "registry"},
        extra={"n": 2, "mesh_member": True},
    )
    assert p["dag"]["transaction_count"] == 1237
    assert p["spa"]["total"] == 6
    assert p["spa"]["source"] == "registry"
    assert p["n"] == 2
    assert p["mesh_member"] is True


def test_registry_summary_types():
    from tip_selection import DAG
    reg = SPARegistry(DAG())
    empty = reg.summary()
    assert empty["total"] == 0
    assert empty["source"] == "empty"
    assert isinstance(empty["total"], int)
    assert empty["seed_only"] is False


def test_honest_helpers_reject_none():
    d = _honest_dag({"transaction_count": None})
    assert d["transaction_count"] == 0
    s = _honest_spa({"total": None})
    assert s["total"] == 0


def test_ensure_self_spa_registers_only_self():
    """GH#178 seed path: empty → one fog SPA for node_id; no fabricated peers."""
    import tempfile
    import os
    os.environ["FOG_TESTNET"] = "1"  # skip workerd attach in PersistentFogNode
    from node_persistent import PersistentFogNode
    with tempfile.TemporaryDirectory() as td:
        db = os.path.join(td, "fog-test.db")
        node = PersistentFogNode(node_id="FOG-NODE-TEST-001", db_path=db)
        s = node.spas.summary()
        assert s["total"] == 1, s
        assert s["active"] == 1
        assert s["source"] == "registry"
        assert s["seed_only"] is False
        assert s["by_role"].get("fog") == 1
        assert node.ensure_self_spa() is None
        assert node.spas.summary()["total"] == 1
        assert "edge" not in s["by_role"]


if __name__ == "__main__":
    failed = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok", name)
            except Exception as e:
                failed += 1
                print("FAIL", name, type(e).__name__, e)
    if failed:
        sys.exit(1)
    print("status pulse honesty ok")
