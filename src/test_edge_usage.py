"""C_mesh = f(1-U) invariants."""
from __future__ import annotations

import unittest

from edge_usage import c_mesh


class EdgeUsageTests(unittest.TestCase):
    def test_idle_foreground_offers_near_cap(self):
        r = c_mesh({"cpu": 0.05, "battery": 0.9, "thermal": "nominal", "net": 0.05, "foreground": True})
        self.assertGreater(r["C_mesh"], 0.6)
        self.assertEqual(r["why"], "residual")

    def test_busy_drops_offer(self):
        idle = c_mesh({"cpu": 0.05, "battery": 0.9, "thermal": "nominal", "foreground": True})
        busy = c_mesh({"cpu": 0.9, "battery": 0.9, "thermal": "nominal", "foreground": True})
        self.assertGreater(idle["C_mesh"], busy["C_mesh"])

    def test_background_duty_is_fraction(self):
        fg = c_mesh({"cpu": 0.1, "battery": 0.8, "thermal": "nominal", "foreground": True})
        bg = c_mesh({"cpu": 0.1, "battery": 0.8, "thermal": "nominal", "foreground": False})
        self.assertAlmostEqual(bg["C_mesh"] / fg["C_mesh"], 0.25, delta=0.08)

    def test_low_battery_clamps_zero(self):
        r = c_mesh({"cpu": 0.0, "battery": 0.12, "thermal": "nominal", "foreground": True})
        self.assertEqual(r["C_mesh"], 0.0)
        self.assertEqual(r["why"], "safety_clamp")

    def test_thermal_critical_clamps_zero(self):
        r = c_mesh({"cpu": 0.0, "battery": 1.0, "thermal": "critical", "foreground": True})
        self.assertEqual(r["C_mesh"], 0.0)

    def test_low_power_clamps_zero(self):
        r = c_mesh({"cpu": 0.0, "battery": 0.8, "low_power": True, "foreground": True})
        self.assertEqual(r["C_mesh"], 0.0)


if __name__ == "__main__":
    unittest.main()
