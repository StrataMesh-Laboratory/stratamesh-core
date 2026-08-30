#!/usr/bin/env python3
"""Origin fallback state machine — in-process, no network, no secrets."""
from __future__ import annotations

import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from origin_lease import FALLBACK_AFTER_SEC, decide, parse_iso  # noqa: E402


def ts(iso: str) -> float:
    v = parse_iso(iso)
    assert v is not None
    return v


class DecideTests(unittest.TestCase):
    def setUp(self):
        self.now = ts("2026-08-30T04:00:00Z")

    def test_mac_primary_clears_timer(self):
        self.assertEqual(
            decide({"public": False, "mac_down_since": "2026-08-30T03:00:00Z"},
                   mac_alive=True, local_ok=True, now=self.now),
            "clear_down",
        )

    def test_mac_back_while_session_public_yields(self):
        self.assertEqual(
            decide({"public": True, "fallback": True},
                   mac_alive=True, local_ok=True, now=self.now),
            "yield_to_mac",
        )

    def test_reclaim_beats_mac_alive(self):
        self.assertEqual(
            decide({"public": True, "reclaim_requested_at": "2026-08-30T03:59:00Z"},
                   mac_alive=True, local_ok=True, now=self.now),
            "honor_reclaim",
        )

    def test_mark_down_on_first_miss(self):
        self.assertEqual(
            decide({"public": False},
                   mac_alive=False, local_ok=True, now=self.now),
            "mark_down",
        )

    def test_wait_under_30m(self):
        self.assertEqual(
            decide({"public": False, "mac_down_since": "2026-08-30T03:45:00Z"},
                   mac_alive=False, local_ok=True, now=self.now),
            "wait",
        )

    def test_take_at_30m(self):
        self.assertEqual(
            decide({"public": False, "mac_down_since": "2026-08-30T03:30:00Z"},
                   mac_alive=False, local_ok=True, now=self.now),
            "take",
        )

    def test_hold_if_local_fog_down(self):
        self.assertEqual(
            decide({"public": False, "mac_down_since": "2026-08-30T03:00:00Z"},
                   mac_alive=False, local_ok=False, now=self.now),
            "hold_unhealthy",
        )

    def test_already_fallback_stays(self):
        self.assertEqual(
            decide({"public": True, "fallback": True, "mac_down_since": "2026-08-30T03:00:00Z"},
                   mac_alive=False, local_ok=True, now=self.now),
            "stay",
        )

    def test_non_session_never_takes(self):
        self.assertEqual(
            decide({"public": False, "mac_down_since": "2026-08-30T03:00:00Z"},
                   mac_alive=False, local_ok=True, now=self.now, role_name="macbook"),
            "stay",
        )

    def test_after_sec_override(self):
        self.assertEqual(
            decide({"public": False, "mac_down_since": "2026-08-30T03:59:00Z"},
                   mac_alive=False, local_ok=True, now=self.now, after_sec=60),
            "take",
        )

    def test_fallback_constant_is_30_min(self):
        self.assertEqual(FALLBACK_AFTER_SEC, 1800)

    def test_parse_roundtrip(self):
        iso = "2026-08-30T04:00:00Z"
        self.assertEqual(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts(iso))), iso)


if __name__ == "__main__":
    unittest.main()
