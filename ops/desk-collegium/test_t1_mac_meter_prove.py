"""T1 Mac meter short-circuit — no fake iPhone; act+evidence delivers."""
from __future__ import annotations

import json
import time
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock


class T1MacMeterProve(unittest.TestCase):
    def test_fresh_mac_meter_returns_act_not_done(self):
        import desk_ops as ops

        with tempfile.TemporaryDirectory() as td:
            fog = Path(td)
            meters = fog / "data" / "desk-meters"
            meters.mkdir(parents=True)
            meter = {
                "ok": True,
                "mac_addr_match": True,
                "mac_addr": "10.88.0.2",
                "ping_10_88_0_1": True,
                "openvpn_client_conf_present": True,
                "iphone_prove": False,
                "prove_path": "status/t1-wg-mac-prove.txt",
                "sha": "deadbeef",
            }
            (meters / "wg-t1.json").write_text(json.dumps(meter) + "\n")
            with mock.patch.object(ops, "FOG", fog):
                out = ops._try_t1_mac_meter_prove({"id": "dt-proj-ts-taper-t1"})
            self.assertIsNotNone(out)
            self.assertTrue(out["ok"])
            self.assertTrue(out["evidence"])
            self.assertEqual(out["verb"], "act")
            self.assertFalse(out["done"])
            self.assertIn("desk-meters/wg-t1.json", out["result"])
            self.assertIn("iphone_prove=false", out["result"])

    def test_iphone_true_marks_done(self):
        import desk_ops as ops

        with tempfile.TemporaryDirectory() as td:
            fog = Path(td)
            meters = fog / "data" / "desk-meters"
            meters.mkdir(parents=True)
            meter = {
                "ok": True,
                "mac_addr_match": True,
                "mac_addr": "10.88.0.2",
                "iphone_prove": True,
                "prove_path": "status/t1.txt",
                "sha": "abc",
            }
            (meters / "wg-t1.json").write_text(json.dumps(meter) + "\n")
            with mock.patch.object(ops, "FOG", fog):
                out = ops._try_t1_mac_meter_prove({"id": "dt-proj-ts-taper-t1"})
            self.assertTrue(out["done"])
            self.assertEqual(out["verb"], "done")



    def test_stale_meter_live_refresh(self):
        """Age >960s must live-refresh (not return None / hermes thrash)."""
        import desk_ops as ops

        with tempfile.TemporaryDirectory() as td:
            fog = Path(td)
            meters = fog / "data" / "desk-meters"
            meters.mkdir(parents=True)
            meter_path = meters / "wg-t1.json"
            old = {
                "ok": True,
                "mac_addr_match": True,
                "mac_addr": "10.88.0.2",
                "ping_10_88_0_1": True,
                "openvpn_client_conf_present": True,
                "iphone_prove": False,
                "prove_path": "status/old.txt",
                "sha": "deadbeef",
            }
            meter_path.write_text(json.dumps(old) + "\n", encoding="utf-8")
            old_ts = time.time() - 2000
            os.utime(meter_path, (old_ts, old_ts))
            fresh = {
                "ok": True,
                "mac_addr_match": True,
                "mac_addr": "10.88.0.2",
                "ping_10_88_0_1": True,
                "openvpn_client_conf_present": True,
                "iphone_prove": False,
                "prove_path": "status/fresh.txt",
                "sha": "abc1234",
                "refreshed": True,
            }
            with mock.patch.object(ops, "FOG", fog), mock.patch.object(
                ops, "_refresh_t1_mac_meter_live", return_value=fresh
            ) as refresh:
                out = ops._try_t1_mac_meter_prove({"id": "dt-proj-ts-taper-t1", "intent": "T1 WG 10.88"})
            self.assertTrue(refresh.called)
            self.assertIsNotNone(out)
            self.assertTrue(out["ok"])
            self.assertTrue(out["evidence"])
            self.assertEqual(out["verb"], "act")
            self.assertFalse(out["done"])
            self.assertIn("refreshed=true", out["result"])


if __name__ == "__main__":
    unittest.main()
