#!/usr/bin/env python3
"""
B0 emission audit — compare PoC ledger vs STRATA supply on a live node or report consistency.
"""

from __future__ import annotations
import argparse
import json
import urllib.request


def get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())


def audit_url(base: str) -> dict:
    base = base.rstrip("/")
    poc = get(f"{base}/contribution")
    tok = get(f"{base}/token")
    st = get(f"{base}/status")

    poc_total = float(poc.get("total_minted") or sum((poc.get("balances") or {}).values()) or 0)
    supply = float(tok.get("total_supply") or 0)
    holders = tok.get("balances") or {}

    # Lab invariant: STRATA supply should be ≤ PoC total credits (1:1 mint of deltas)
    ok = supply <= poc_total + 1e-9
    return {
        "node_id": st.get("node_id"),
        "poc_total_credits": poc_total,
        "strata_supply": supply,
        "holders": holders,
        "mint_events": tok.get("mint_events"),
        "invariant_supply_le_poc": ok,
        "unminted_poc_delta": max(0.0, poc_total - supply),
        "dag_txs": (st.get("dag") or {}).get("transaction_count"),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="http://127.0.0.1:8787")
    args = p.parse_args()
    report = audit_url(args.url)
    print(json.dumps(report, indent=2))
    if not report["invariant_supply_le_poc"]:
        raise SystemExit("AUDIT FAIL: STRATA supply exceeds PoC credits")
    print("AUDIT OK")


if __name__ == "__main__":
    main()
