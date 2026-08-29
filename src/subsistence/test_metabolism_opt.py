"""Optional on-graph metabolism — exclusive-off by default.

Run:
  PYTHONPATH=src python3 src/subsistence/test_metabolism_opt.py
  python3 src/subsistence/test_metabolism_opt.py
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1]
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from subsistence.metabolism_opt import (  # noqa: E402
    ALLOW,
    HOLD,
    P0_BORROW,
    STASIS,
    consume_grace_tick,
    decide,
    gate_spend,
    opted_in,
    remaining_for,
    verdict_to_action,
)
from subsistence.policy import PressureAction, SubsistencePolicy  # noqa: E402
from subsistence.runtime import SubsistenceRuntime  # noqa: E402


class TestOptInFlag(unittest.TestCase):
    def test_strings_and_bool(self):
        self.assertTrue(opted_in("metabolism"))
        self.assertTrue(opted_in("metabolism.v1.3"))
        self.assertTrue(opted_in(True))
        self.assertTrue(opted_in("true"))
        self.assertTrue(opted_in({"spend_policy": "metabolism"}))
        self.assertTrue(opted_in({"spend_policy": "metabolism.v1.3"}))
        self.assertTrue(opted_in({"meta": {"spend_policy": True}}))

    def test_opt_out(self):
        self.assertFalse(opted_in(None))
        self.assertFalse(opted_in(False))
        self.assertFalse(opted_in({}))
        self.assertFalse(opted_in({"spend_policy": "policy.py"}))
        self.assertFalse(opted_in("exclusive"))


class TestDefaultPoSbsUnchanged(unittest.TestCase):
    """Default consume/tick without opt-in matches the runtime demo path.

    Solvent FOG-OP stays active; deficit ACB hibernates via policy.py
    (grace ticks then hibernate_below), not via metabolism.
    """

    def _run_demo_sequence(self):
        events = []

        def on_pressure(agent_id, action):
            events.append((agent_id, action.value))

        rt = SubsistenceRuntime(on_pressure=on_pressure)
        rt.register("ACB-001", reserve=5.0, tau=0.0)
        rt.register("FOG-OP-7", reserve=20.0, tau=0.0)

        # Existing runtime demo numbers (runtime.py:demo).
        rt.consume("FOG-OP-7", compute=2.0, energy=1.0)
        rt.earn("FOG-OP-7", compute=5.0)
        rt.consume("ACB-001", compute=8.0, memory_time=3.0, energy=2.0)
        rt.earn("ACB-001", compute=1.0)

        reports = []
        for i, label in enumerate(["settle #1", "settle #2 (continued deficit)", "settle #3"]):
            if i >= 1:
                rt.consume("ACB-001", compute=6.0, memory_time=2.0)
                rt.earn("ACB-001", compute=0.5)
                rt.consume("FOG-OP-7", compute=1.0)
                rt.earn("FOG-OP-7", compute=3.0)
            reports.append((label, rt.tick()))
        # Grace is exhausted after the three demo ticks; one more settle
        # with no extra consume lets policy.py hibernate on the deficit
        # already accumulated (hibernate_below=-10, migrate_below=-25).
        reports.append(("settle #4 (policy hibernate)", rt.tick()))
        return rt, reports, events

    def test_demo_numbers_fog_solvent_acb_hibernates_via_policy(self):
        rt, reports, events = self._run_demo_sequence()
        last = {r["agent_id"]: r for r in reports[-1][1]}
        fog = last["FOG-OP-7"]
        acb = last["ACB-001"]
        self.assertTrue(fog["solvent"], f"FOG-OP should stay solvent: {fog}")
        self.assertEqual(fog["status"], "active")
        self.assertFalse(acb["solvent"], f"ACB should be in deficit: {acb}")
        self.assertEqual(acb["action"], PressureAction.HIBERNATE.value)
        self.assertEqual(acb["status"], "hibernating")
        # Metabolism was not in this path — exclusive-off.
        g = gate_spend(meta=None, kind="acb-pos-wallet", wallet=0.0, hours_left=1.0, cost=99.0)
        self.assertEqual(g.decision, ALLOW)
        self.assertFalse(g.opted_in)

    def test_gate_opt_out_always_allow(self):
        g = gate_spend(
            meta={"spend_policy": "off"},
            kind="acb-pos-wallet",
            wallet=0.0,
            hours_left=24.0,
            cost=100.0,
            url="https://example.workers.dev/no-get",
        )
        self.assertEqual(g.decision, ALLOW)
        self.assertTrue(g.granted)
        self.assertEqual(g.action, PressureAction.NONE)


class TestOptedInACBWallet(unittest.TestCase):
    def test_cannot_dump_whole_wallet_in_one_tick(self):
        g = gate_spend(
            meta={"spend_policy": "metabolism"},
            kind="acb-pos-wallet",
            wallet=10.0,
            hours_left=10.0,
            cost=10.0,
        )
        self.assertTrue(g.opted_in)
        self.assertIn(g.decision, (HOLD, STASIS), f"dump should HOLD/STASIS, got {g.as_dict()}")
        self.assertFalse(g.granted)
        self.assertLess(g.grant, 10.0)
        self.assertEqual(g.action, PressureAction.OPTIMIZE if g.decision == HOLD else PressureAction.HIBERNATE)

    def test_small_spend_within_hourly_cap_allows(self):
        g = gate_spend(
            meta="metabolism.v1.3",
            kind="acb-pos-wallet",
            wallet=24.0,
            hours_left=24.0,
            cost=0.5,
        )
        self.assertEqual(g.decision, ALLOW, g.as_dict())
        self.assertTrue(g.granted)
        self.assertAlmostEqual(g.remaining, 24.0)
        self.assertAlmostEqual(g.hourly_cap, 1.0, places=4)

    def test_p0_borrow_maps_to_optimize_and_consumes_grace(self):
        g = gate_spend(
            meta=True,
            kind="acb-pos-wallet",
            wallet=0.0,
            hours_left=8.0,
            cost=1.0,
            is_p0=True,
        )
        self.assertEqual(g.decision, P0_BORROW, g.as_dict())
        self.assertEqual(verdict_to_action(g.decision), PressureAction.OPTIMIZE)
        pol = SubsistencePolicy()
        self.assertEqual(consume_grace_tick(pol, pol.max_grace_ticks), pol.max_grace_ticks - 1)


class TestNFTCollateral(unittest.TestCase):
    def test_spendable_is_collateral_minus_floor(self):
        self.assertAlmostEqual(remaining_for("strata-nft-collateral", collateral=1.1), 1.0)
        self.assertAlmostEqual(remaining_for("strata-nft-collateral", collateral=0.1), 0.0)
        self.assertAlmostEqual(remaining_for("strata-nft-collateral", collateral=0.05), 0.0)
        self.assertAlmostEqual(remaining_for("nft", collateral=0.3, floor=0.1), 0.2)

    def test_stasis_when_remaining_at_or_below_floor(self):
        g = gate_spend(
            meta="metabolism",
            kind="strata-nft-collateral",
            collateral=0.1,
            hours_left=8.0,
            cost=0.01,
        )
        self.assertEqual(g.decision, STASIS, g.as_dict())
        self.assertEqual(g.action, PressureAction.HIBERNATE)
        self.assertAlmostEqual(g.remaining, 0.0)
        self.assertFalse(g.granted)

    def test_pace_preserves_collateral_across_hours(self):
        g = gate_spend(
            meta="metabolism",
            kind="strata-nft-collateral",
            collateral=1.1,  # spendable 1.0
            hours_left=10.0,
            cost=1.0,  # would dump the spendable in one tick
        )
        self.assertIn(g.decision, (HOLD, STASIS), g.as_dict())
        self.assertAlmostEqual(g.remaining, 1.0)


class TestNodeUserRail(unittest.TestCase):
    def test_same_as_acb_wallet_subject_spends_object(self):
        kwargs = dict(meta=True, wallet=5.0, hours_left=5.0, cost=5.0)
        a = gate_spend(kind="acb-pos-wallet", **kwargs)
        b = gate_spend(kind="node-user-consume", **kwargs)
        self.assertEqual(a.decision, b.decision)
        self.assertIn(a.decision, (HOLD, STASIS))
        self.assertAlmostEqual(remaining_for("node-user-consume", wallet=5.0), 5.0)
        self.assertAlmostEqual(remaining_for("acb-pos-wallet", wallet=5.0), 5.0)

    def test_fog_treasury_is_not_a_citizen_rail(self):
        g = gate_spend(meta=True, kind="NODE_WALLET", wallet=1000.0, hours_left=1.0, cost=1.0)
        self.assertEqual(g.decision, STASIS)
        self.assertIn("treasury", g.reason.lower())
        self.assertEqual(remaining_for("NODE_WALLET", wallet=1000.0), 0.0)


class TestWorkersDevStasis(unittest.TestCase):
    def test_url_passed_to_decide_is_stasis(self):
        # Do not GET the URL — decide() only inspects the string.
        v = decide(
            "acb-pos-wallet",
            remaining=100.0,
            hours_left=24.0,
            cost=1.0,
            url="https://example.workers.dev/health",
            cfg={"timezone": "Europe/Lisbon", "rails": {}},
        )
        decision = getattr(v, "decision", v)
        self.assertEqual(decision, STASIS, v)

    def test_gate_opted_in_workers_dev_stasis(self):
        g = gate_spend(
            meta="metabolism",
            kind="acb-pos-wallet",
            wallet=100.0,
            hours_left=24.0,
            cost=1.0,
            url="https://status.example.workers.dev/",
        )
        self.assertEqual(g.decision, STASIS, g.as_dict())
        self.assertEqual(g.action, PressureAction.HIBERNATE)


class TestCircuitUnadjusted(unittest.TestCase):
    def test_burst_cannot_inflate_past_window(self):
        # remaining=24, hours_left=24 → hourly_cap=1. hour_spent=2 → STASIS at 2×.
        g = gate_spend(
            meta="metabolism",
            kind="acb-pos-wallet",
            wallet=24.0,
            hours_left=24.0,
            cost=0.1,
            hour_spent=2.0,
        )
        self.assertEqual(g.decision, STASIS, g.as_dict())


class TestVerdictMapping(unittest.TestCase):
    def test_table(self):
        self.assertEqual(verdict_to_action(ALLOW), PressureAction.NONE)
        self.assertEqual(verdict_to_action(HOLD), PressureAction.OPTIMIZE)
        self.assertEqual(verdict_to_action(STASIS), PressureAction.HIBERNATE)
        self.assertEqual(verdict_to_action(P0_BORROW), PressureAction.OPTIMIZE)


if __name__ == "__main__":
    unittest.main()
