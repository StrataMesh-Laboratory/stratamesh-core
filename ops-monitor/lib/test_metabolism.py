#!/usr/bin/env python3
"""Unit tests for metabolic stasis. Run: python3 lib/test_metabolism.py"""
from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from metabolism import (  # noqa: E402
    ALLOW, HOLD, STASIS, P0_BORROW, LISBON,
    decide, hours_until_renewal, monitor_interval_sec, snapshot, load_rails,
    record_spend, empty_rail_state, phase_delta,
    density_of, effective_capacity, coalesce_intents, circuit_trip,
)

CFG = load_rails()


def T(hour, minute=0, day=28):
    return datetime(2026, 8, day, hour, minute, tzinfo=LISBON)


class HoursLeft(unittest.TestCase):
    def test_noon_to_midnight(self):
        h = hours_until_renewal(T(12, 0), "00:00", "Europe/Lisbon")
        self.assertAlmostEqual(h, 12.0, places=2)

    def test_23_30_wraps(self):
        h = hours_until_renewal(T(23, 30), "00:00", "Europe/Lisbon")
        self.assertAlmostEqual(h, 0.5, places=2)

    def test_floor_one_minute(self):
        h = hours_until_renewal(T(23, 59), "00:00", "Europe/Lisbon")
        self.assertGreaterEqual(h, 1 / 60)


class GrokSlots(unittest.TestCase):
    def test_early_morning_contingency(self):
        v = decide("grok-auto", now=T(0, 30), cost=1, cfg=CFG)
        self.assertEqual(v.decision, ALLOW)
        self.assertEqual(v.remaining, 6)
        self.assertEqual(v.reserved, 4)
        self.assertEqual(v.spendable, 2)

    def test_watchdog_slot_at_04(self):
        v = decide("grok-auto", now=T(4, 0), cost=1, slot_id="watchdog", cfg=CFG)
        self.assertEqual(v.decision, ALLOW)
        self.assertEqual(v.reserved, 3)

    def test_unscheduled_at_12_after_two_slots(self):
        v = decide("grok-auto", now=T(12, 0), cost=1, cfg=CFG)
        self.assertEqual(v.remaining, 4)
        self.assertEqual(v.reserved, 2)
        self.assertEqual(v.decision, ALLOW)

    def test_protect_peaks_when_contingency_gone(self):
        v = decide("grok-auto", remaining=2, now=T(17, 0), cost=1, cfg=CFG)
        self.assertEqual(v.reserved, 2)
        self.assertEqual(v.decision, HOLD)

    def test_peak_18_fires_on_last_contingency(self):
        v = decide("grok-auto", remaining=2, now=T(18, 0), cost=1,
                   is_peak=True, slot_id="discourse-pulse", cfg=CFG)
        self.assertEqual(v.decision, ALLOW)

    def test_exhausted_is_stasis(self):
        v = decide("grok-auto", remaining=0, now=T(18, 0), cost=1,
                   is_peak=True, slot_id="discourse-pulse", cfg=CFG)
        self.assertEqual(v.decision, STASIS)

    def test_p0_borrow(self):
        v = decide("grok-auto", remaining=0, now=T(3, 0), cost=1, is_p0=True, cfg=CFG)
        self.assertEqual(v.decision, P0_BORROW)


class RateRails(unittest.TestCase):
    def test_github_within_hour(self):
        reset = int(T(12, 30).timestamp())
        v = decide("github-core", remaining=4000, now=T(12, 0), cost=10,
                   reset_unix=reset, cfg=CFG)
        self.assertEqual(v.decision, ALLOW)
        self.assertGreater(v.hourly_cap, 1000)

    def test_pace_slow_window(self):
        v = decide("deomail", remaining=5, now=T(12, 0), cost=10, cfg=CFG)
        self.assertIn(v.decision, (HOLD, STASIS))

    def test_actions_forbidden(self):
        v = decide("aiops-actions", now=T(12, 0), cfg=CFG)
        self.assertEqual(v.decision, STASIS)

    def test_xai_payg_paced(self):
        v = decide("xai-api", remaining=24, now=T(0, 0), cost=5, cfg=CFG)
        # 24/24h = 1/hour, cost 5 > 1 → HOLD
        self.assertEqual(v.decision, HOLD)

    def test_github_graphql_pace(self):
        v = decide("github-graphql", remaining=3496, now=T(12, 0), cost=100, cfg=CFG)
        self.assertEqual(v.decision, ALLOW)


class Monitor(unittest.TestCase):
    def test_day_interval(self):
        self.assertEqual(monitor_interval_sec(T(14, 0), CFG, ledger={}), 300)

    def test_night_interval(self):
        self.assertEqual(monitor_interval_sec(T(23, 30), CFG, ledger={}), 900)
        self.assertEqual(monitor_interval_sec(T(3, 0), CFG, ledger={}), 900)


class Snapshot(unittest.TestCase):
    def test_shape(self):
        s = snapshot(T(12, 0), cfg=CFG, ledger={"schema": "x", "rails": {}})
        self.assertEqual(s["schema"], "stratamesh.metabolism.v1.2")
        self.assertTrue(s["no_sixth_cron"])
        self.assertIn("grok-auto", s["rails"])
        self.assertIn("xai-api", s["rails"])
        self.assertIn("github-graphql", s["rails"])
        self.assertEqual(len(s["slots"]), 4)
        self.assertFalse(s["night"])
        self.assertEqual(s["monitor_interval_sec"], 300)


class PhaseDelta(unittest.TestCase):
    def test_hours(self):
        self.assertEqual(phase_delta("2026-08-28T04", "2026-08-28T07"), 3)
        self.assertEqual(phase_delta("2026-08-28T23", "2026-08-29T01"), 2)


class OverdraftCompensation(unittest.TestCase):
    def test_unscheduled_hold_when_carry_thin(self):
        ledger = {"schema": "x", "rails": {}}
        v = decide("grok-auto", now=T(0, 30), cost=1, cfg=CFG, ledger=ledger)
        self.assertEqual(v.decision, HOLD)
        self.assertLess(v.carry, 1)

    def test_peak_may_overdraft_hour(self):
        ledger = {"schema": "x", "rails": {}}
        v = record_spend("grok-auto", 1, now=T(9, 0), cfg=CFG, ledger=ledger,
                         is_peak=True, slot_id="dev-cycle", persist=False)
        self.assertEqual(v.decision, ALLOW)
        self.assertLess(v.carry, 0)  # grant ~0.4, cost 1 → overdraft

    def test_quiet_hours_pay_back(self):
        ledger = {"schema": "x", "rails": {}}
        record_spend("grok-auto", 1, now=T(9, 0), cfg=CFG, ledger=ledger,
                     is_peak=True, slot_id="dev-cycle", persist=False)
        carry_after_peak = ledger["rails"]["grok-auto"]["carry"]
        self.assertLess(carry_after_peak, 0)
        # 6 quiet hours later
        v = decide("grok-auto", now=T(15, 0), cost=1, cfg=CFG, ledger=ledger,
                   is_peak=True, slot_id="discourse-pulse")
        self.assertGreater(v.carry, carry_after_peak)  # compensated
        self.assertEqual(v.decision, ALLOW)

    def test_forced_overspend_debits_next_day(self):
        ledger = {"schema": "x", "rails": {}}
        now = T(12, 0)
        for _ in range(7):
            record_spend("grok-auto", 1, now=now, cfg=CFG, ledger=ledger,
                         persist=False, force=True)
        st = ledger["rails"]["grok-auto"]
        self.assertGreater(st["day_spent"], 6)
        self.assertGreater(st["daily_debt"], 0)
        # next day: remaining reduced by debt
        v = decide("grok-auto", remaining=6, now=T(0, 30, day=29), cfg=CFG, ledger=ledger)
        self.assertLess(v.remaining, 6)

    def test_github_resets_carry_each_hour(self):
        ledger = {"schema": "x", "rails": {}}
        record_spend("github-core", 100, now=T(12, 0), cfg=CFG, ledger=ledger,
                     remaining=5000, persist=False, force=True)
        v = decide("github-core", remaining=5000, now=T(13, 0), cfg=CFG, ledger=ledger)
        # persist false → carry reset to this hour's grant, not leftover debt
        self.assertGreater(v.carry, 1000)

    def test_xai_overdraft_compensated(self):
        ledger = {"schema": "x", "rails": {}}
        v = record_spend("xai-api", 5, now=T(10, 0), cfg=CFG, ledger=ledger,
                         remaining=24, persist=False, force=True)
        self.assertLess(v.carry, 0)
        v2 = decide("xai-api", remaining=19, now=T(14, 0), cfg=CFG, ledger=ledger)
        self.assertGreater(v2.carry, v.carry)


class Density(unittest.TestCase):
    def test_signal_per_token(self):
        self.assertEqual(density_of(8, 1), 8)
        self.assertEqual(density_of(1, 8), 0.125)

    def test_effective_capacity_multiplies(self):
        self.assertEqual(effective_capacity(4167, 8), 4167 * 8)

    def test_workers_dev_forbidden(self):
        v = decide(
            "cf-worker-req", remaining=100000, now=T(1, 0),
            url="https://stratamesh-deomail.stratamesh.workers.dev/health",
            cfg=CFG,
        )
        self.assertEqual(v.decision, STASIS)
        self.assertIn("workers.dev", v.reason)

    def test_low_density_hold(self):
        v = decide("cf-worker-req", remaining=100000, now=T(1, 0),
                   cost=8, signal=1, cfg=CFG)
        self.assertEqual(v.decision, HOLD)
        self.assertIn("density", v.reason)

    def test_coalesced_health_allows(self):
        v = decide("cf-worker-req", remaining=100000, now=T(1, 0),
                   cost=1, signal=8, cfg=CFG)
        self.assertEqual(v.decision, ALLOW)
        self.assertGreaterEqual(v.density, 8)

    def test_circuit_stasis_at_2x(self):
        v = decide("cf-worker-req", remaining=100000, now=T(1, 0),
                   hour_spent=9000, cfg=CFG)
        self.assertEqual(v.decision, STASIS)
        self.assertEqual(v.circuit, STASIS)

    def test_anti_3hz(self):
        v = decide("cf-worker-req", remaining=100000, now=T(1, 0),
                   last_same_ms=200, cfg=CFG)
        self.assertEqual(v.decision, HOLD)

    def test_coalesce_drops_workers_dev_and_dupes(self):
        plan = coalesce_intents([
            {"rail": "cf-worker-req", "url": "https://status.calhegasmorais.pt/health", "signal": 1},
            {"rail": "cf-worker-req", "url": "https://aiops.calhegasmorais.pt/health", "signal": 1},
            {"rail": "cf-worker-req", "url": "https://edge.calhegasmorais.pt/health", "signal": 1},
            {"rail": "cf-worker-req", "url": "https://status.calhegasmorais.pt/health", "signal": 1},
            {"rail": "cf-worker-req", "url": "https://x.stratamesh.workers.dev/health", "signal": 1},
            {"rail": "cf-pages", "url": "https://calhegasmorais.pt/", "pages": True, "signal": 1},
        ], CFG)
        urls = [p.get("url") for p in plan]
        self.assertTrue(any("calhegasmorais.pt/" == u.rstrip("/")[-20:] or "calhegasmorais.pt" in (u or "") and "/health" not in (u or "") for u in urls) or any(p.get("pages") for p in plan))
        self.assertFalse(any("workers.dev" in (u or "") for u in urls))
        worker = [p for p in plan if p.get("coalesced")]
        self.assertEqual(len(worker), 1)
        self.assertEqual(worker[0]["coalesced"], 3)
        self.assertEqual(worker[0]["signal"], 3)
        self.assertEqual(worker[0]["cost"], 1)

    def test_lockstep_rail_forbidden(self):
        v = decide("lockstep-probe", now=T(1, 0), cfg=CFG)
        self.assertEqual(v.decision, STASIS)

    def test_circuit_helper(self):
        self.assertEqual(circuit_trip(9000, 4167, CFG), STASIS)
        self.assertEqual(circuit_trip(5300, 4167, CFG), HOLD)
        self.assertEqual(circuit_trip(100, 4167, CFG), "")


if __name__ == "__main__":
    unittest.main(verbosity=2)

