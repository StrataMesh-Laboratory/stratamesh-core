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
        h = hours_until_renewal(T(23, 59, 59) if False else T(23, 59), "00:00", "Europe/Lisbon")
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
        self.assertEqual(v.reserved, 3)  # 09, 18, 23 still ahead

    def test_unscheduled_at_12_after_two_slots(self):
        # 04:00 and 09:00 assumed fired (grace 20m)
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
        # remaining 4000, 30 min to reset → hourly_cap 8000, cost 10 ALLOW
        reset = int(T(12, 30).timestamp())
        v = decide("github-core", remaining=4000, now=T(12, 0), cost=10,
                   reset_unix=reset, cfg=CFG)
        self.assertEqual(v.decision, ALLOW)
        self.assertGreater(v.hourly_cap, 1000)

    def test_pace_slow_window(self):
        # 12 requests left, 12 hours to UTC midnight-ish via renewal — use remaining/hours
        v = decide("deomail", remaining=5, now=T(12, 0), cost=10, cfg=CFG)
        self.assertIn(v.decision, (HOLD, STASIS))

    def test_actions_forbidden(self):
        v = decide("aiops-actions", now=T(12, 0), cfg=CFG)
        self.assertEqual(v.decision, STASIS)


class Monitor(unittest.TestCase):
    def test_day_interval(self):
        self.assertEqual(monitor_interval_sec(T(14, 0), CFG), 300)

    def test_night_interval(self):
        self.assertEqual(monitor_interval_sec(T(23, 30), CFG), 900)
        self.assertEqual(monitor_interval_sec(T(3, 0), CFG), 900)


class Snapshot(unittest.TestCase):
    def test_shape(self):
        s = snapshot(T(12, 0), cfg=CFG)
        self.assertEqual(s["schema"], "stratamesh.metabolism.v1")
        self.assertTrue(s["no_sixth_cron"])
        self.assertIn("grok-auto", s["rails"])
        self.assertEqual(len(s["slots"]), 4)
        self.assertFalse(s["night"])
        self.assertEqual(s["monitor_interval_sec"], 300)


if __name__ == "__main__":
    unittest.main(verbosity=2)
