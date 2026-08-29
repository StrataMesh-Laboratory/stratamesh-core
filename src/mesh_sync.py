"""
Mesh sync helpers — Track A1
============================
Inventory exchange + full-tx pull/push between HTTP peers.
"""

from __future__ import annotations
import json
import urllib.request
from typing import List, Dict, Any

# Optional Tor SOCKS5h egress (exclusive-off). See ops/tor/README.md.
# Unset FOG_TOR_SOCKS / TOR_SOCKS → stdlib urllib, identical to before.
try:
    from tor_socks import urlopen as _urlopen
except ImportError:
    _urlopen = urllib.request.urlopen


def get_json(url: str, timeout: float = 5) -> dict:
    with _urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode())


def post_json(url: str, data: dict, timeout: float = 5) -> Any:
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with _urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def peer_inv(base: str) -> List[str]:
    st = get_json(f"{base.rstrip('/')}/inv")
    return list(st.get("ids") or [])


def peer_status(base: str) -> dict:
    return get_json(f"{base.rstrip('/')}/status")


def fetch_tx(base: str, tx_id: str) -> dict | None:
    try:
        return get_json(f"{base.rstrip('/')}/tx/{tx_id}")
    except Exception:
        return None


def push_tx(base: str, tx: dict) -> dict:
    return post_json(f"{base.rstrip('/')}/tx/ingest", tx)


def sync_pair(a: str, b: str) -> dict:
    inv_a = set(peer_inv(a))
    inv_b = set(peer_inv(b))
    only_a = list(inv_a - inv_b)[:80]
    only_b = list(inv_b - inv_a)[:80]
    pushed_to_b = pushed_to_a = 0
    for tid in only_a:
        tx = fetch_tx(a, tid)
        if tx:
            try:
                push_tx(b, tx)
                pushed_to_b += 1
            except Exception:
                pass
    for tid in only_b:
        tx = fetch_tx(b, tid)
        if tx:
            try:
                push_tx(a, tx)
                pushed_to_a += 1
            except Exception:
                pass
    return {
        "a": a,
        "b": b,
        "inv_a": len(inv_a),
        "inv_b": len(inv_b),
        "pushed_to_b": pushed_to_b,
        "pushed_to_a": pushed_to_a,
    }


def sync_mesh(bases: List[str], rounds: int = 3) -> List[dict]:
    reports = []
    for _ in range(rounds):
        for i in range(len(bases)):
            for j in range(i + 1, len(bases)):
                try:
                    reports.append(sync_pair(bases[i], bases[j]))
                except Exception as e:
                    reports.append({"a": bases[i], "b": bases[j], "error": str(e)})
    return reports


def mesh_report(bases: List[str]) -> dict:
    nodes = []
    for b in bases:
        try:
            st = peer_status(b)
            nodes.append(
                {
                    "base": b,
                    "node_id": st.get("node_id"),
                    "txs": st.get("dag", {}).get("transaction_count"),
                    "tips": st.get("dag", {}).get("tip_count"),
                }
            )
        except Exception as e:
            nodes.append({"base": b, "error": str(e)})
    return {"nodes": nodes}


def sync_spas(bases: List[str]) -> dict:
    """Exchange SPA registries across peers."""
    all_recs = []
    for b in bases:
        try:
            data = get_json(f"{b.rstrip('/')}/spa/export")
            all_recs.extend(data.get("spas") or [])
        except Exception:
            pass
    # dedupe by spa_id
    by_id = {r["spa_id"]: r for r in all_recs if r.get("spa_id")}
    payload = {"spas": list(by_id.values())}
    results = {}
    for b in bases:
        try:
            results[b] = post_json(f"{b.rstrip('/')}/spa/import", payload)
        except Exception as e:
            results[b] = {"error": str(e)}
    return {"unique_spas": len(by_id), "results": results}
