#!/usr/bin/env python3
"""Hypothesis properties for metabolic stasis v1.3 (0.2.2 appraisal).

Library tests only — do not couple to Fog ingest / src / workers.
Pinned: hypothesis==6.165.10 (requirements-dev.txt).

Invariants:
- 0.5 <= pace_factor <= 1.5
- circuit uses UNadjusted hourly_cap; pace>1 must never ALLOW when
  hour_spent >= 2 * base hourly_cap
- HOLD at 1.25x, STASIS at 2x unadjusted
- unknown remaining → HOLD, never invent 100000
- expired reset without live sample → HOLD
- replay: same ledger+inputs+timestamps → same verdict
"""
from __future__ import annotations

import copy
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

def _ensure_hypothesis() -> None:
    try:
        import hypothesis  # noqa: F401
        return
    except ImportError:
        pass
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--user", "hypothesis==6.165.10"],
    )


_ensure_hypothesis()

from hypothesis import HealthCheck, assume, given, settings, strategies as st  # noqa: E402
from metabolism import (  # noqa: E402
    ALLOW, HOLD, STASIS,
    LISBON,
    circuit_trip, day_key, decide, load_rails, live_decide_kwargs,
    pace_factor, phase_key, snapshot,
)

CFG = load_rails()
UNKNOWN_RAILS = tuple(
    name for name, spec in (CFG.get("rails") or {}).items()
    if spec.get("unknown_remaining") == "hold"
)
RATE_RAILS = tuple(
    name for name, spec in (CFG.get("rails") or {}).items()
    if spec.get("kind") == "rate"
    and spec.get("hard_cap") != 0
    and not spec.get("stasis_until")
)

settings.register_profile(
    "metab",
    max_examples=80,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture, HealthCheck.differing_executors],
)
settings.load_profile("metab")


def T(hour, minute=0, day=28):
    return datetime(2026, 8, day, hour, minute, tzinfo=LISBON)


def _finite(lo, hi):
    return st.floats(min_value=lo, max_value=hi, allow_nan=False, allow_infinity=False)


def _inflator_ledger(rail: str, now: datetime, day_spent: float, remaining: float) -> dict:
    spec = (CFG.get("rails") or {}).get(rail) or {}
    phase = phase_key(now, spec, CFG)
    dkey = day_key(now, spec, CFG)
    grant = remaining / 24.0 if remaining else 0.0
    return {
        "schema": "x",
        "rails": {
            rail: {
                "phase": phase,
                "day": dkey,
                "carry": grant,
                "daily_debt": 0.0,
                "daily_credit": 0.0,
                "phase_spent": 0.0,
                "day_spent": float(day_spent),
                "phase_grant": grant,
                "overdraft_events": 0,
            }
        },
    }


class PaceFactorBounds(unittest.TestCase):
    @given(
        day_spent=_finite(0.0, 1e6),
        daily_limit=_finite(0.0, 1e6),
        hours_left=_finite(0.0, 48.0),
        window_hours=_finite(0.1, 48.0),
    )
    def test_pace_factor_clamped(self, day_spent, daily_limit, hours_left, window_hours):
        pf = pace_factor(day_spent, daily_limit, hours_left, window_hours)
        self.assertGreaterEqual(pf, 0.5)
        self.assertLessEqual(pf, 1.5)
        if daily_limit <= 0 or day_spent <= 0:
            self.assertEqual(pf, 1.0)

    @given(
        remaining=_finite(1.0, 1e5),
        day_spent=_finite(0.0, 1e5),
        hour=st.integers(min_value=0, max_value=23),
        minute=st.integers(min_value=0, max_value=59),
    )
    def test_decide_pace_factor_clamped(self, remaining, day_spent, hour, minute):
        now = T(hour, minute)
        ledger = _inflator_ledger("cf-worker-req", now, day_spent, remaining)
        v = decide(
            "cf-worker-req", remaining=remaining, now=now, cost=1, signal=8,
            cfg=CFG, ledger=ledger,
        )
        self.assertGreaterEqual(v.pace_factor, 0.5)
        self.assertLessEqual(v.pace_factor, 1.5)


class CircuitUnadjusted(unittest.TestCase):
    @given(
        hourly_cap=_finite(0.01, 1e5),
        hour_spent=_finite(0.0, 5e5),
    )
    def test_circuit_trip_thresholds(self, hourly_cap, hour_spent):
        trip = circuit_trip(hour_spent, hourly_cap, CFG)
        if hour_spent >= hourly_cap * 2.0:
            self.assertEqual(trip, STASIS)
        elif hour_spent >= hourly_cap * 1.25:
            self.assertEqual(trip, HOLD)
        else:
            self.assertEqual(trip, "")

    @given(
        remaining=_finite(100.0, 1e5),
        day_spent=_finite(1e-3, 50.0),
        hour=st.integers(min_value=1, max_value=22),
        over=st.floats(min_value=2.0, max_value=8.0, allow_nan=False, allow_infinity=False),
    )
    def test_inflator_never_allow_at_2x_unadjusted(self, remaining, day_spent, hour, over):
        """pace>1 must never ALLOW when hour_spent >= 2 * base hourly_cap."""
        now = T(hour, 0)
        ledger = _inflator_ledger("cf-worker-req", now, day_spent, remaining)
        v0 = decide(
            "cf-worker-req", remaining=remaining, now=now, cost=1, signal=8,
            cfg=CFG, ledger=copy.deepcopy(ledger),
        )
        assume(v0.hourly_cap > 0)
        assume(v0.pace_factor > 1.0)
        hour_spent = over * v0.hourly_cap
        v = decide(
            "cf-worker-req", remaining=remaining, now=now, cost=1, signal=8,
            hour_spent=hour_spent, cfg=CFG, ledger=copy.deepcopy(ledger),
        )
        self.assertNotEqual(v.decision, ALLOW)
        self.assertEqual(v.circuit, STASIS)
        self.assertEqual(v.decision, STASIS)
        # circuit must have used unadjusted cap, not adjusted = cap * pf
        self.assertGreaterEqual(hour_spent, v.hourly_cap * 2.0)
        if v0.pace_factor > 1.0:
            self.assertLess(v.hourly_cap * 2.0, v.hourly_cap * v0.pace_factor * 2.0)

    @given(
        remaining=_finite(100.0, 1e5),
        day_spent=_finite(1e-3, 50.0),
        hour=st.integers(min_value=1, max_value=22),
        hold_x=st.floats(min_value=1.25, max_value=1.99, allow_nan=False, allow_infinity=False),
    )
    def test_hold_at_1_25x_unadjusted(self, remaining, day_spent, hour, hold_x):
        now = T(hour, 0)
        ledger = _inflator_ledger("cf-worker-req", now, day_spent, remaining)
        v0 = decide(
            "cf-worker-req", remaining=remaining, now=now, cost=1, signal=8,
            cfg=CFG, ledger=copy.deepcopy(ledger),
        )
        assume(v0.hourly_cap > 0)
        hour_spent = hold_x * v0.hourly_cap
        assume(hour_spent < v0.hourly_cap * 2.0)
        v = decide(
            "cf-worker-req", remaining=remaining, now=now, cost=1, signal=8,
            hour_spent=hour_spent, cfg=CFG, ledger=copy.deepcopy(ledger),
            is_peak=False, is_p0=False,
        )
        self.assertEqual(v.circuit, HOLD)
        self.assertEqual(v.decision, HOLD)
        self.assertNotEqual(v.decision, ALLOW)


class UnknownRemaining(unittest.TestCase):
    @given(
        rail=st.sampled_from(UNKNOWN_RAILS),
        hour=st.integers(min_value=0, max_value=23),
        minute=st.integers(min_value=0, max_value=59),
        is_peak=st.booleans(),
    )
    def test_unknown_remaining_holds_never_invents_100000(self, rail, hour, minute, is_peak):
        v = decide(rail, remaining=None, now=T(hour, minute), cfg=CFG, is_peak=is_peak)
        self.assertEqual(v.decision, HOLD)
        self.assertEqual(v.remaining, 0)
        self.assertEqual(v.hourly_cap, 0)
        self.assertNotEqual(v.remaining, 100000)
        self.assertNotEqual(v.hourly_cap, 100000)
        self.assertIn("do not invent a cap", v.reason)

    @given(hour=st.integers(min_value=0, max_value=23))
    def test_live_unknown_skips_stale_remaining(self, hour):
        now = T(hour)
        kw = live_decide_kwargs(
            "cf-worker-req",
            CFG["rails"]["cf-worker-req"],
            {"cf-worker-req": {"unknown": True}},
            {"rails": {"cf-worker-req": {"sampled_remaining": 100000}}},
            now,
            CFG,
        )
        self.assertNotIn("remaining", kw)
        v = decide("cf-worker-req", remaining=None, now=now, cfg=CFG)
        self.assertEqual(v.decision, HOLD)
        self.assertEqual(v.remaining, 0)


class ExpiredReset(unittest.TestCase):
    @given(
        remaining=_finite(0.0, 2e5),
        hours_ago=_finite(0.001, 200.0),
        rail=st.sampled_from(UNKNOWN_RAILS),
        hour=st.integers(min_value=0, max_value=23),
    )
    def test_expired_reset_holds_not_dump_cap(self, remaining, hours_ago, rail, hour):
        now = T(hour)
        past = int(now.astimezone(timezone.utc).timestamp() - hours_ago * 3600)
        v = decide(rail, remaining=remaining, reset_unix=past, now=now, cfg=CFG)
        self.assertEqual(v.decision, HOLD)
        self.assertEqual(v.hourly_cap, 0)
        self.assertEqual(v.hours_left, 0)
        self.assertIn("expired reset", v.reason)
        # never remaining / 1-minute dump cap
        if remaining > 0:
            dump = remaining / (1.0 / 60.0)
            self.assertLess(v.hourly_cap, dump)

    @given(
        remaining=_finite(1.0, 5000.0),
        hours_ago=_finite(0.01, 48.0),
    )
    def test_snapshot_expired_ledger_sample_holds(self, remaining, hours_ago):
        now = T(12, 0)
        past = int(now.astimezone(timezone.utc).timestamp() - hours_ago * 3600)
        s = snapshot(
            now,
            live={},
            cfg=CFG,
            ledger={"schema": "x", "rails": {
                "github-core": {
                    "sampled_remaining": remaining,
                    "sampled_reset_unix": past,
                },
            }},
        )
        row = s["rails"]["github-core"]
        self.assertEqual(row["decision"], HOLD)
        self.assertLess(row["hourly_cap"], 10000)


class ReplaySameVerdict(unittest.TestCase):
    @given(
        remaining=_finite(0.0, 1e5),
        cost=_finite(0.0, 50.0),
        signal=_finite(1.0, 20.0),
        hour=st.integers(min_value=0, max_value=23),
        minute=st.integers(min_value=0, max_value=59),
        hour_spent=st.one_of(st.none(), _finite(0.0, 2e4)),
        day_spent=_finite(0.0, 1e4),
        is_peak=st.booleans(),
        is_p0=st.booleans(),
        rail=st.sampled_from(RATE_RAILS),
    )
    def test_replay_same_ledger_inputs_timestamps(
        self, remaining, cost, signal, hour, minute, hour_spent, day_spent,
        is_peak, is_p0, rail,
    ):
        now = T(hour, minute)
        original = _inflator_ledger(rail, now, day_spent, remaining)
        kw = dict(
            remaining=remaining, now=now, cost=cost, signal=signal,
            hour_spent=hour_spent, is_peak=is_peak, is_p0=is_p0, cfg=CFG,
        )
        v1 = decide(rail, ledger=copy.deepcopy(original), **kw)
        v2 = decide(rail, ledger=copy.deepcopy(original), **kw)
        self.assertEqual(v1.as_dict(), v2.as_dict())
        # same object after settle is also stable
        ledger = copy.deepcopy(original)
        v3 = decide(rail, ledger=ledger, **kw)
        v4 = decide(rail, ledger=ledger, **kw)
        self.assertEqual(v3.decision, v4.decision)
        self.assertEqual(v3.as_dict(), v4.as_dict())


if __name__ == "__main__":
    unittest.main(verbosity=2)
