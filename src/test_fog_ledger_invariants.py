"""Hypothesis property tests for StrataTokenLedger used by node_persistent.

Honesty (lab-only, not multi-host):
  FOG-NODE-PT-CM-001 and EDGE-GROK-CMN-001 share the STRATAGROK agent computer.
  These tests exercise in-process StrataTokenLedger accounting only — the same
  class wired into PersistentFogNode.token. They do not claim mesh membership,
  Oracle VM, aBFT, mainnet, multi-host gossip, or live Worker deploy.

Run (from src/):
  python3 -m pip install -r ../requirements-dev.txt   # hypothesis
  python3 test_fog_ledger_invariants.py

Distinct from test_economic_invariants.py (WIRE I1–I6 LabLedger harness).
"""
from __future__ import annotations

import sys
import unittest

from hypothesis import assume, given, settings, strategies as st

from strata_token import StrataTokenLedger

HONESTY = (
    "lab-only single-host Fog/EDGE on the STRATAGROK agent computer; "
    "not multi-host mesh"
)

AGENTS = st.sampled_from(
    ["FOG-NODE-PT-CM-001", "EDGE-GROK-CMN-001", "lab-a", "lab-b"]
)
# Cent-resolution amounts avoid float-dust while staying in ledger float domain.
AMOUNTS = st.integers(min_value=1, max_value=10**8).map(lambda n: n / 100.0)
RATES = st.sampled_from([0.5, 1.0, 1.2, 2.0])


def _conserved(led: StrataTokenLedger) -> bool:
    spendable = sum(led.balances.values())
    return abs(spendable - led.total_supply) < 1e-9 and all(
        v >= -1e-12 for v in led.balances.values()
    )


class TestHonestyHeader(unittest.TestCase):
    def test_honesty_banner_is_lab_only_not_multi_host(self) -> None:
        self.assertIn("lab-only", HONESTY)
        self.assertIn("not multi-host", HONESTY)
        self.assertNotIn("mesh_member=true", HONESTY)


class TestStrataTokenLedgerProperties(unittest.TestCase):
    @given(agent=AGENTS, credit=AMOUNTS, rate=RATES)
    @settings(max_examples=40, deadline=None)
    def test_mint_from_poc_increases_supply_and_balance(
        self, agent: str, credit: float, rate: float
    ) -> None:
        led = StrataTokenLedger()
        ev = led.mint_from_poc(agent, credit, rate=rate, ref="lab-hypothesis")
        expected = credit * rate
        self.assertGreater(ev.amount, 0.0)
        self.assertAlmostEqual(ev.amount, expected, places=9)
        self.assertAlmostEqual(led.balance(agent), expected, places=9)
        self.assertAlmostEqual(led.total_supply, expected, places=9)
        self.assertTrue(_conserved(led))

    @given(st.sampled_from([0.0, -0.01, -1.0]))
    @settings(max_examples=10, deadline=None)
    def test_non_positive_mint_rejected(self, credit: float) -> None:
        led = StrataTokenLedger()
        with self.assertRaises(ValueError):
            led.mint_from_poc("FOG-NODE-PT-CM-001", credit)

    @given(frm=AGENTS, to=AGENTS, credit=AMOUNTS, send=AMOUNTS)
    @settings(max_examples=50, deadline=None)
    def test_transfer_conserves_supply(
        self, frm: str, to: str, credit: float, send: float
    ) -> None:
        assume(frm != to)
        led = StrataTokenLedger()
        led.mint_from_poc(frm, credit, rate=1.0)
        before_supply = led.total_supply
        before_from = led.balance(frm)
        before_to = led.balance(to)
        ok = led.transfer(frm, to, send)
        if send <= before_from:
            self.assertTrue(ok)
            self.assertAlmostEqual(led.balance(frm), before_from - send, places=9)
            self.assertAlmostEqual(led.balance(to), before_to + send, places=9)
        else:
            self.assertFalse(ok)
            self.assertAlmostEqual(led.balance(frm), before_from, places=9)
            self.assertAlmostEqual(led.balance(to), before_to, places=9)
        self.assertAlmostEqual(led.total_supply, before_supply, places=9)
        self.assertTrue(_conserved(led))

    @given(
        a=AMOUNTS,
        b=AMOUNTS,
        t1=AMOUNTS,
        t2=AMOUNTS,
    )
    @settings(max_examples=40, deadline=None)
    def test_sequence_never_goes_negative_or_prints_money(
        self, a: float, b: float, t1: float, t2: float
    ) -> None:
        led = StrataTokenLedger()
        fog, edge = "FOG-NODE-PT-CM-001", "EDGE-GROK-CMN-001"
        led.mint_from_poc(fog, a, rate=1.0)
        led.mint_from_poc(edge, b, rate=1.0)
        led.transfer(fog, edge, t1)
        led.transfer(edge, fog, t2)
        self.assertTrue(_conserved(led))
        self.assertGreaterEqual(led.balance(fog), -1e-12)
        self.assertGreaterEqual(led.balance(edge), -1e-12)
        self.assertAlmostEqual(led.total_supply, a + b, places=9)

    def test_transfer_exact_balance_zeros_sender(self) -> None:
        led = StrataTokenLedger()
        led.mint_from_poc("FOG-NODE-PT-CM-001", 10.0, rate=1.0)
        self.assertTrue(led.transfer("FOG-NODE-PT-CM-001", "EDGE-GROK-CMN-001", 10.0))
        self.assertAlmostEqual(led.balance("FOG-NODE-PT-CM-001"), 0.0, places=9)
        self.assertAlmostEqual(led.balance("EDGE-GROK-CMN-001"), 10.0, places=9)
        self.assertTrue(_conserved(led))


if __name__ == "__main__":
    print("Honesty:", HONESTY)
    r = unittest.main(verbosity=2, exit=False)
    sys.exit(0 if r.result.wasSuccessful() else 1)
