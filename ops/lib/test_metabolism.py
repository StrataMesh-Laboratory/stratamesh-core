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
    pace_factor, live_decide_kwargs, pace_failed, admit, metabol_pace, mesh_map, resolve_hop,
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
        self.assertEqual(s["schema"], "stratamesh.metabolism.v1.3")
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


class PaceAndStasis(unittest.TestCase):
    def test_neutral_when_no_spend(self):
        v = decide("github-core", remaining=4000, now=T(12, 0), cost=10, cfg=CFG)
        self.assertEqual(v.pace_factor, 1.0)
        self.assertEqual(v.decision, ALLOW)
        self.assertEqual(pace_factor(0, 5000, 1.0), 1.0)

    def test_deflator_when_overspent(self):
        # almost daily_limit spent early in the window → pf < 1
        ledger = {"schema": "x", "rails": {
            "deomail": {
                "phase": "2026-08-28T01",
                "day": "2026-08-28",
                "carry": 10.0,
                "daily_debt": 0.0,
                "daily_credit": 0.0,
                "phase_spent": 0.0,
                "day_spent": 230.0,
                "phase_grant": 10.0,
                "overdraft_events": 0,
            }
        }}
        v = decide("deomail", remaining=10, now=T(1, 0), cost=1, cfg=CFG, ledger=ledger)
        self.assertLess(v.pace_factor, 1.0)
        self.assertLessEqual(v.deflator, 1.0)
        self.assertEqual(v.inflator, 1.0)

    def test_inflator_when_underspent(self):
        # tiny spend late in the window → pf > 1 and <= 1.5
        ledger = {"schema": "x", "rails": {
            "deomail": {
                "phase": "2026-08-28T23",
                "day": "2026-08-28",
                "carry": 10.0,
                "daily_debt": 0.0,
                "daily_credit": 0.0,
                "phase_spent": 0.0,
                "day_spent": 1.0,
                "phase_grant": 10.0,
                "overdraft_events": 0,
            }
        }}
        v = decide("deomail", remaining=239, now=T(23, 0), cost=1, cfg=CFG, ledger=ledger)
        self.assertGreater(v.pace_factor, 1.0)
        self.assertLessEqual(v.pace_factor, 1.5)
        self.assertGreaterEqual(v.inflator, 1.0)
        self.assertEqual(v.deflator, 1.0)

    def test_hf_stasis_until(self):
        v = decide("hf-inference", now=T(12, 0), cfg=CFG)
        self.assertEqual(v.decision, STASIS)
        self.assertIn("2026-09-01", v.reason)

    def test_aws_free_hard(self):
        v = decide("aws-free", now=T(12, 0), cfg=CFG)
        self.assertEqual(v.decision, STASIS)

    def test_unknown_remaining_holds_without_inventing_cap(self):
        v = decide("grok-bot-included", now=T(12, 0), cfg=CFG)
        self.assertEqual(v.decision, HOLD)
        self.assertIn("do not invent a cap", v.reason)
        v2 = decide("grok-assistant", now=T(12, 0), cfg=CFG)
        self.assertEqual(v2.decision, HOLD)
        # live remaining=0 (usage_limit) still pauses
        v3 = decide("grok-bot-included", remaining=0, now=T(12, 0), cfg=CFG)
        self.assertEqual(v3.decision, STASIS)


class SuperGrokRemainingFrac(unittest.TestCase):
    """Live SuperGrok weekly pool is remaining_frac, not an invented token/prompt cap."""

    RESET = int(datetime(2026, 8, 31, 14, 55, tzinfo=LISBON).timestamp())

    def test_remaining_frac_096_allow(self):
        v = decide(
            "grok-assistant",
            remaining_frac=0.96,
            now=T(1, 5, day=29),
            reset_unix=self.RESET,
            cost=0,
            cfg=CFG,
        )
        self.assertEqual(v.decision, ALLOW)
        self.assertAlmostEqual(v.remaining, 0.96)
        self.assertGreater(v.hours_left, 60)
        self.assertAlmostEqual(v.hourly_cap, 0.96 / v.hours_left, places=4)
        self.assertEqual(CFG["rails"]["grok-assistant"]["daily_limit"], 1.0)

    def test_remaining_frac_zero_stasis(self):
        v = decide("grok-assistant", remaining_frac=0, now=T(12, 0), cost=0, cfg=CFG)
        self.assertEqual(v.decision, STASIS)

    def test_none_plus_unknown_remaining_hold(self):
        v = decide("grok-assistant", now=T(12, 0), cfg=CFG)
        self.assertEqual(v.decision, HOLD)
        self.assertIn("do not invent a cap", v.reason)
        # remaining is 0, not an invented weekly token number
        self.assertEqual(v.remaining, 0)
        self.assertEqual(v.hourly_cap, 0)

    def test_cost_one_is_not_the_whole_pool(self):
        # remaining_frac 0.96 with cost=1 must NOT STASIS as if cost were 100% of the weekly pool
        v = decide(
            "grok-assistant",
            remaining_frac=0.96,
            now=T(1, 5, day=29),
            reset_unix=self.RESET,
            cost=1,
            cfg=CFG,
        )
        self.assertEqual(v.decision, ALLOW)
        self.assertAlmostEqual(v.remaining, 0.96)

    def test_snapshot_pages_alias_not_second_100k(self):
        s = snapshot(T(12, 0), live={"cf-worker-req": {"remaining": 99990}}, cfg=CFG,
                     ledger={"schema": "x", "rails": {}})
        self.assertEqual(s["rails"]["cf-pages"]["decision"], "ALIAS")
        self.assertEqual(s["rails"]["cf-pages"]["shares_pool"], "cf-worker-req")
        self.assertNotEqual(s["rails"]["cf-pages"].get("remaining"), 100000)
        self.assertAlmostEqual(s["hourly_cap_after_refill"], s["rails"]["cf-worker-req"]["hourly_cap"])
        self.assertNotEqual(s["hourly_cap_after_refill"], 4167)


class CircuitWiredCallers(unittest.TestCase):
    """snapshot() + watchdog decide() path must pass hour_spent and fail closed."""

    def test_snapshot_hold_at_1_25x_hourly_cap(self):
        live = {"cf-worker-req": {"remaining": 100000, "hour_spent": 5300}}
        s = snapshot(T(1, 0), live=live, cfg=CFG, ledger={"schema": "x", "rails": {}})
        row = s["rails"]["cf-worker-req"]
        self.assertEqual(row["decision"], HOLD)
        self.assertEqual(row["circuit"], HOLD)
        self.assertEqual(row["hour_spent"], 5300)
        self.assertLess(row["hourly_cap"] * 1.25, 5300)

    def test_snapshot_stasis_at_2x_hourly_cap(self):
        live = {"cf-worker-req": {"remaining": 100000, "hour_spent": 9000}}
        s = snapshot(T(1, 0), live=live, cfg=CFG, ledger={"schema": "x", "rails": {}})
        row = s["rails"]["cf-worker-req"]
        self.assertEqual(row["decision"], STASIS)
        self.assertEqual(row["circuit"], STASIS)
        self.assertGreaterEqual(9000, row["hourly_cap"] * 2)

    def test_snapshot_unknown_remaining_holds(self):
        s = snapshot(T(1, 0), live={"cf-worker-req": {"unknown": True}}, cfg=CFG,
                     ledger={"schema": "x", "rails": {"cf-worker-req": {"sampled_remaining": 100000}}})
        row = s["rails"]["cf-worker-req"]
        self.assertEqual(row["decision"], HOLD)
        self.assertIn("do not invent a cap", row["reason"])
        self.assertEqual(row["hourly_cap"], 0)

    def test_watchdog_path_hold_stasis_unknown(self):
        # same decide() signature the watchdog uses after live_decide_kwargs
        v_hold = decide("cf-worker-req", remaining=100000, hour_spent=5300,
                        now=T(1, 0), cost=1, signal=8, cfg=CFG)
        self.assertEqual(v_hold.decision, HOLD)
        self.assertEqual(v_hold.circuit, HOLD)
        v_stasis = decide("cf-worker-req", remaining=100000, hour_spent=9000,
                          now=T(1, 0), cost=1, signal=8, cfg=CFG)
        self.assertEqual(v_stasis.decision, STASIS)
        self.assertEqual(v_stasis.circuit, STASIS)
        v_unk = decide("cf-worker-req", remaining=None, now=T(1, 0), cost=1, signal=8, cfg=CFG)
        self.assertEqual(v_unk.decision, HOLD)
        self.assertIn("do not invent a cap", v_unk.reason)

    def test_expired_reset_unix_holds_not_dump_cap(self):
        past = int(T(11, 0).timestamp())
        s = snapshot(
            T(12, 0),
            live={},
            cfg=CFG,
            ledger={"schema": "x", "rails": {
                "github-core": {"sampled_remaining": 5000, "sampled_reset_unix": past},
            }},
        )
        row = s["rails"]["github-core"]
        self.assertEqual(row["decision"], HOLD)
        self.assertLess(row["hourly_cap"], 10000)  # not remaining/1min = 300000
        v = decide("github-core", remaining=5000, reset_unix=past, now=T(12, 0), cfg=CFG)
        self.assertEqual(v.decision, HOLD)
        self.assertIn("expired reset_unix", v.reason)
        self.assertLess(v.hourly_cap, 10000)

    def test_live_day_spent_paces(self):
        live = {"cf-worker-req": {"remaining": 50000, "used": 50000, "hour_spent": 100}}
        s = snapshot(T(12, 0), live=live, cfg=CFG, ledger={"schema": "x", "rails": {}})
        row = s["rails"]["cf-worker-req"]
        self.assertEqual(row["day_spent"], 50000)
        self.assertNotEqual(row["pace_factor"], 1.0)

    def test_live_decide_kwargs_unknown_skips_ledger(self):
        kw = live_decide_kwargs(
            "cf-worker-req",
            CFG["rails"]["cf-worker-req"],
            {"cf-worker-req": {"unknown": True}},
            {"rails": {"cf-worker-req": {"sampled_remaining": 100000}}},
            T(1, 0),
            CFG,
        )
        self.assertNotIn("remaining", kw)



class PaceVsFreeze(unittest.TestCase):
    """STASIS is min pace. Freeze only after pace_failed with no contingency."""

    def test_allow_never_freeze(self):
        v = decide("cf-worker-req", remaining=100000, now=T(1, 0), cost=1, signal=8, cfg=CFG)
        self.assertEqual(v.decision, ALLOW)
        self.assertFalse(v.freeze)
        a = admit(v, {"rand": 0.0})
        self.assertTrue(a["admit"])
        self.assertFalse(a["freeze"])

    def test_first_stasis_trip_freeze_false(self):
        v = decide(
            "cf-worker-req", remaining=100000, now=T(1, 0),
            hour_spent=9000, cfg=CFG, prev_circuit=ALLOW,
        )
        self.assertEqual(v.decision, STASIS)
        self.assertEqual(v.circuit, STASIS)
        self.assertFalse(v.freeze)
        self.assertFalse(v.pace_failed)
        self.assertFalse(pace_failed(prev_circuit=ALLOW, circuit=STASIS, hour_spent=9000, hourly_cap=v.hourly_cap))
        a = admit(v, {"rand": 0.99, "prev_circuit": ALLOW, "hour_spent": 9000})
        self.assertFalse(a["freeze"])
        self.assertEqual(a["reason"], "pace STASIS min (not freeze)")

    def test_second_stasis_after_prev_stasis_freezes_non_p0(self):
        v = decide(
            "cf-worker-req", remaining=100000, now=T(1, 0),
            hour_spent=9000, cfg=CFG, prev_circuit=STASIS,
        )
        self.assertEqual(v.decision, STASIS)
        self.assertTrue(v.pace_failed)
        self.assertTrue(v.freeze)
        a = admit(v, {"rand": 0.0, "prev_circuit": STASIS, "hour_spent": 9000, "is_p0": False})
        self.assertFalse(a["admit"])
        self.assertTrue(a["freeze"])

    def test_p0_still_admits_on_freeze(self):
        v = decide(
            "cf-worker-req", remaining=100000, now=T(1, 0),
            hour_spent=9000, cfg=CFG, prev_circuit=STASIS, is_p0=True,
        )
        a = admit(v, {"rand": 0.0, "prev_circuit": STASIS, "hour_spent": 9000, "is_p0": True})
        self.assertTrue(a["admit"])
        self.assertFalse(a["freeze"])
        self.assertEqual(a["reason"], P0_BORROW)

    def test_hold_never_freeze(self):
        v = decide("cf-worker-req", remaining=100000, now=T(1, 0),
                   hour_spent=5300, cfg=CFG)
        self.assertEqual(v.decision, HOLD)
        self.assertFalse(v.freeze)
        a_yes = admit(v, {"rand": 0.0})  # deflator <= 1, rand 0 admits
        a_no = admit({**v.as_dict(), "deflator": 0.5, "circuit": HOLD, "decision": HOLD}, {"rand": 0.9})
        self.assertFalse(a_yes["freeze"])
        self.assertFalse(a_no["freeze"])
        self.assertTrue(a_yes["admit"])
        self.assertFalse(a_no["admit"])
        self.assertGreaterEqual(a_no["retry_after_sec"], 30)

    def test_pace_failed_plus_contingency_fail_open(self):
        pack = {
            "decision": STASIS, "circuit": STASIS, "deflator": 0.5,
            "hourly_cap": 1000, "remaining": 50000, "hour_spent": 9000,
            "prev_circuit": STASIS,
            "contingency_url": "https://auth.calhegasmorais.pt",
            "contingency_ok": True,
        }
        self.assertTrue(pace_failed(prev_circuit=STASIS, circuit=STASIS, hour_spent=9000, hourly_cap=1000))
        a = admit(pack, {"rand": 0.99, "prev_circuit": STASIS, "hour_spent": 9000})
        self.assertTrue(a["admit"])
        self.assertFalse(a["freeze"])
        self.assertEqual(a["via"], "contingency")
        self.assertEqual(a["contingency_url"], "https://auth.calhegasmorais.pt")

    def test_pace_failed_no_contingency_freezes_non_p0(self):
        pack = {
            "decision": STASIS, "circuit": STASIS, "deflator": 0.5,
            "hourly_cap": 1000, "remaining": 50000, "hour_spent": 9000,
            "contingency_url": "", "contingency_ok": False,
        }
        a = admit(pack, {"rand": 0.0, "prev_circuit": HOLD, "hour_spent": 9000, "is_p0": False})
        self.assertFalse(a["admit"])
        self.assertTrue(a["freeze"])

    def test_workers_dev_still_hard_forbidden(self):
        v = decide(
            "cf-worker-req", remaining=100000, now=T(1, 0),
            url="https://x.workers.dev/health", cfg=CFG,
        )
        self.assertEqual(v.decision, STASIS)
        self.assertTrue(v.freeze)
        a = admit({**v.as_dict(), "url": "https://x.workers.dev/health",
                   "contingency_url": "https://auth.calhegasmorais.pt", "contingency_ok": True})
        self.assertTrue(a["freeze"])
        self.assertFalse(a["admit"])



class PerHopMetabolPace(unittest.TestCase):
    def test_local_hops_no_cf_clock(self):
        for hop in ("python:8790", "node:8791", "deno:8792", "fog", "8787"):
            v = metabol_pace(hop, host_over=False, cfg=CFG)
            self.assertEqual(v["decision"], ALLOW)
            self.assertFalse(v.get("cf_daily"))
            self.assertFalse(v["http_503"])

    def test_host_over_is_hold_not_503(self):
        v = metabol_pace("python", host_over=True, cfg=CFG)
        self.assertEqual(v["decision"], HOLD)
        self.assertTrue(v["pace"])
        self.assertFalse(v["freeze"])
        self.assertFalse(v["http_503"])

    def test_pages_outside_worker_bucket(self):
        v = metabol_pace("pages", cfg=CFG)
        self.assertEqual(v["decision"], ALLOW)
        self.assertTrue(v["outside_worker_bucket"])

    def test_kv_own_quota(self):
        v = metabol_pace("kv", remaining=1000, hour_spent=0, cfg=CFG, now=T(1, 0))
        self.assertEqual(v["rail"], "cf-kv-writes")
        self.assertEqual(v["daily_limit"], 1000)
        self.assertEqual(v.get("renewal_tz"), "UTC")

    def test_workerd_cf_100k_utc(self):
        v = metabol_pace("workerd", remaining=100000, hour_spent=0, cfg=CFG, now=T(1, 0))
        self.assertEqual(v["rail"], "cf-worker-req")
        self.assertEqual(v["daily_limit"], 100000)
        self.assertEqual(v.get("renewal_tz"), "UTC")

    def test_login_never_503_on_cf_stasis(self):
        v = metabol_pace(
            "cf-auth", remaining=0, hour_spent=9000, cfg=CFG, now=T(1, 0),
            path="/api/auth/login", is_p0=True,
        )
        self.assertFalse(v["http_503"])
        self.assertFalse(v["freeze"])
        self.assertTrue(v["admit"])

    def test_deno_deploy_allow_fallback(self):
        v = metabol_pace("deno-deploy", cfg=CFG)
        self.assertEqual(v["decision"], ALLOW)
        self.assertTrue(v.get("fallback_only"))

    def test_workers_dev_still_forbidden(self):
        v = metabol_pace("workerd", remaining=100000, cfg=CFG, now=T(1, 0),
                         url="https://x.workers.dev/health")
        self.assertTrue(v.get("freeze") or v["decision"] == STASIS)

    def test_mesh_map_structure(self):
        m = mesh_map()
        self.assertEqual(m["fog"], 8787)
        self.assertEqual(m["ipc"]["deno"], 8792)
        self.assertEqual(m["routes"]["auth_wb_session"][0], "python:8790")
        self.assertEqual(m["routes"]["html"][0], "pages")
        self.assertEqual(resolve_hop("8792"), "deno")


try:
    from test_metabolism_hypothesis import (  # noqa: E402,F401
        PaceFactorBounds,
        CircuitUnadjusted,
        UnknownRemaining,
        ExpiredReset,
        ReplaySameVerdict,
    )
except ImportError:
    pass


if __name__ == "__main__":
    unittest.main(verbosity=2)

