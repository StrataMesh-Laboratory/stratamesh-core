#!/usr/bin/env python3
"""Registered-user PAYG subsistence. No mint. Dashboard registered-only."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from protocol_benchmark import BURN, MINT
from subsistence.user_payg import (
    FLOOR,
    PaygRuntime,
    RESOURCE_ACTIONS,
    STATIC_ACTIONS,
    is_treasury,
)


def test_anonymous_denied_dashboard():
    p = PaygRuntime()
    g = p.gate(None, "dashboard_tick", anonymous=True)
    assert g.ok is False and g.mode == "deny"
    assert "registered" in g.reason


def test_unfunded_static_nfts_only():
    p = PaygRuntime()
    p.register("u1", "user-wallet-1", balance=0.0)
    snap = p.snapshot("u1")
    assert snap["mode"] == "static" and snap["dashboard"] is True
    g = p.gate("u1", "nft_list")
    assert g.ok is True and g.rate == 0
    g2 = p.gate("u1", "orch_chat")
    assert g2.ok is False and g2.mode == "static"
    assert "nft_list" in g2.allowed and "orch_chat" not in g2.allowed


def test_payg_burns_to_zero_not_mint():
    p = PaygRuntime()
    p.register("u2", "user-wallet-2", balance=1.0, fund_via_poc=True)
    before_issued = p.lab.issued
    g = p.gate("u2", "dashboard_tick")
    assert g.ok is True and g.charged == 0.001
    assert p.accounts["u2"].balance == 0.999
    assert p.lab.balances[BURN] >= 0.001
    assert p.lab.issued == before_issued  # not a mint
    assert p.lab.try_pay_mint("user-wallet-2", 0.001) is False
    assert p.lab.try_spend_burn_sink("user-wallet-2", 0.001) is False


def test_floor_blocks_resource():
    p = PaygRuntime()
    p.register("u3", "user-wallet-3", balance=FLOOR, fund_via_poc=True)
    g = p.gate("u3", "orch_chat")
    assert g.ok is False  # would breach floor
    g2 = p.gate("u3", "nft_view")
    assert g2.ok is True


def test_treasury_not_citizen():
    p = PaygRuntime()
    try:
        p.register("fog", "FOG-NODE-PT-CM-001", 10)
        raise AssertionError("treasury registered")
    except ValueError as e:
        assert "treasury" in str(e)
    assert is_treasury("#mint") and is_treasury("#0")


def test_resource_set():
    assert "dashboard_tick" in RESOURCE_ACTIONS
    assert "nft_list" in STATIC_ACTIONS
    assert "nft_mint" in RESOURCE_ACTIONS


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
    print("user payg invariants ok")
