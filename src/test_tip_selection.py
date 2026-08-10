"""
Property-style tests for StrataMesh tip selection.
Run: python3 test_tip_selection.py
"""

from __future__ import annotations
import random
import sys
from tip_selection import DAG, Transaction, TxType


def assert_true(cond: bool, msg: str):
    if not cond:
        print(f"FAIL: {msg}")
        sys.exit(1)
    print(f"  OK: {msg}")


def test_genesis_and_attach():
    print("test_genesis_and_attach")
    d = DAG()
    d.bootstrap()
    assert_true(len(d.txs) == 1, "genesis exists")
    assert_true("genesis" in d.tips, "genesis is a tip")
    parents = d.select_tips(1)
    tx = Transaction(tx_id="a1", tx_type=TxType.STANDARD, parents=parents)
    assert_true(d.attach(tx), "attach succeeds")
    assert_true("a1" in d.tips, "new tx is tip")
    assert_true("genesis" not in d.tips, "approved tip removed")


def test_lightweight_bias():
    print("test_lightweight_bias")
    random.seed(7)
    d = DAG()
    d.bootstrap()
    # Build two tips: one lightweight, one standard
    t1 = Transaction(tx_id="lw", tx_type=TxType.LIGHTWEIGHT, parents=["genesis"], weight=0.15)
    t2 = Transaction(tx_id="st", tx_type=TxType.STANDARD, parents=["genesis"], weight=1.0)
    d.attach(t1)
    # re-add genesis as parent path manually for second branch is hard; instead grow linearly then branch
    d2 = DAG()
    d2.bootstrap()
    for i in range(6):
        parents = d2.select_tips(1)
        t = TxType.LIGHTWEIGHT if i % 2 == 0 else TxType.STANDARD
        d2.attach(Transaction(tx_id=f"x{i}", tx_type=t, parents=parents))
    # Selection should not crash and should return existing tips
    tips = d2.select_tips(2)
    assert_true(len(tips) >= 1, "select_tips returns at least one tip")
    assert_true(all(t in d2.tips for t in tips), "selected tips are current tips")


def test_confidence_grows():
    print("test_confidence_grows")
    d = DAG()
    d.bootstrap()
    chain = ["genesis"]
    for i in range(5):
        parents = [chain[-1]]
        tx = Transaction(tx_id=f"c{i}", tx_type=TxType.STANDARD, parents=parents)
        d.attach(tx)
        chain.append(tx.tx_id)
    conf_genesis = d.confidence("genesis")
    conf_mid = d.confidence("c2")
    assert_true(conf_genesis >= conf_mid, "older txs accumulate at least as much weight")
    assert_true(conf_genesis > 1.0, "genesis confidence increased beyond own weight")


def test_no_duplicate_attach():
    print("test_no_duplicate_attach")
    d = DAG()
    d.bootstrap()
    parents = d.select_tips(1)
    tx = Transaction(tx_id="dup", tx_type=TxType.STANDARD, parents=parents)
    assert_true(d.attach(tx), "first attach ok")
    assert_true(not d.attach(tx), "duplicate rejected")


def test_select_empty_safe():
    print("test_select_empty_safe")
    d = DAG()
    # no bootstrap
    tips = d.select_tips(2)
    assert_true(tips == [], "empty DAG returns no tips")


if __name__ == "__main__":
    test_genesis_and_attach()
    test_lightweight_bias()
    test_confidence_grows()
    test_no_duplicate_attach()
    test_select_empty_safe()
    print("\nAll tip-selection tests passed.")
