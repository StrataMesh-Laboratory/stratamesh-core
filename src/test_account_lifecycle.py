#!/usr/bin/env python3
"""Per-account #mint/#0 lifecycle on-graph. Isolated wallets. Not a mint for hire."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from account_lifecycle import AccountGraph, is_citizen, wallet_for
from protocol_benchmark import BURN, MINT, NODE_WALLET
from subsistence.user_payg import PaygRuntime
from tip_selection import TxType


def test_open_is_not_mint():
    g = AccountGraph()
    a = g.open("u1")
    assert a.wallet.startswith("sm:u:")
    assert g.lab.issued == 0
    assert g.balance(a.wallet) == 0
    assert a.opened_tx
    txs = [t for t in g.dag.txs.values() if t.tx_id == a.opened_tx]
    assert txs and txs[0].tx_type == TxType.ACCOUNT


def test_mint_individuates():
    g = AccountGraph()
    a = g.open("alice")
    b = g.open("bob")
    r = g.mint_poc(a.wallet, 5.0, kind="edge_keepup")
    assert r["ok"] and g.balance(a.wallet) == 5
    assert g.balance(b.wallet) == 0
    assert g.lab.balances.get(NODE_WALLET, 0) == 0
    assert g.lab.issued == 5
    assert g.lab.balances.get(MINT, 0) == 0


def test_burn_to_zero_not_fog():
    g = AccountGraph()
    a = g.open("alice")
    g.mint_poc(a.wallet, 4.0)
    r = g.burn(a.wallet, 1.5, "dashboard_tick")
    assert r["ok"]
    assert g.balance(a.wallet) == 2.5
    assert g.lab.balances[BURN] == 1.5
    assert g.lab.balances.get(NODE_WALLET, 0) == 0
    assert g.lab.invariant_i6()
    kinds = [e["kind"] for e in a.events]
    assert "mint" in kinds and "burn" in kinds


def test_hire_is_transfer_not_mint():
    g = AccountGraph()
    a = g.open("alice")
    b = g.open("bob")
    g.mint_poc(a.wallet, 3.0)
    issued = g.lab.issued
    r = g.transfer(a.wallet, b.wallet, 1.0, reason="hire")
    assert r["ok"] and r["mint"] is False
    assert g.lab.issued == issued
    assert g.balance(a.wallet) == 2
    assert g.balance(b.wallet) == 1
    assert g.transfer(a.wallet, MINT, 0.1)["ok"] is False
    assert g.transfer(BURN, b.wallet, 0.1)["ok"] is False


def test_treasury_not_citizen():
    g = AccountGraph()
    try:
        g.open("fog", NODE_WALLET)
        raise AssertionError("opened treasury")
    except ValueError:
        pass
    assert not is_citizen("#mint")
    assert not is_citizen("#0")
    assert is_citizen(wallet_for("x"))


def test_payg_wires_graph():
    g = AccountGraph()
    p = PaygRuntime(lab_ledger=g.lab, graph=g)
    p.register("u", wallet_for("u"), balance=1.0, fund_via_poc=True)
    assert g.balance(wallet_for("u")) == 1.0
    gate = p.gate("u", "dashboard_tick")
    assert gate.ok and gate.charged == 0.001
    snap = g.snapshot(wallet_for("u"))
    assert snap["burned_to_#0"] == 0.001
    assert snap["minted_from_#mint"] == 1.0


def test_replay_from_dag():
    g = AccountGraph()
    a = g.open("alice")
    b = g.open("bob")
    g.mint_poc(a.wallet, 4.0)
    g.burn(a.wallet, 1.0, "orch_chat")
    g.transfer(a.wallet, b.wallet, 0.5, "hire")
    g2 = AccountGraph(dag=g.dag)
    assert abs(g2.balance(a.wallet) - 2.5) < 1e-9
    assert abs(g2.balance(b.wallet) - 0.5) < 1e-9
    assert g2.lab.issued == 4.0
    assert abs(g2.lab.burned - 1.0) < 1e-9
    assert g2.lab.invariant_i6()
    assert g2.lab.try_pay_mint(a.wallet, 0.1) is False
    assert g2.lab.try_spend_burn_sink(b.wallet, 0.1) is False


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
    print("account lifecycle ok")
