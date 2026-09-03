#!/usr/bin/env python3
"""Public/edge lamp hysteresis: no LIVE<->PUBLIC? flicker on one timeout."""
from __future__ import annotations

import importlib.util
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

_TMP = Path(tempfile.mkdtemp(prefix="fog-tui-pub-"))
os.environ["FOG_HOME"] = str(_TMP)
os.environ["FOG_TUI_KEEP_STDERR"] = "1"
(_TMP / "data").mkdir(parents=True, exist_ok=True)

_SRC = Path(__file__).resolve().parent / "fog-tui.py"
_SPEC = importlib.util.spec_from_file_location("fog_tui_pub", _SRC)
_MOD = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(_MOD)
_MOD.FOG = _TMP
_MOD.DEV_TTY = io.StringIO()


class PublicHysteresis(unittest.TestCase):
    def setUp(self):
        _MOD.PUB_CACHE.clear()
        _MOD.EDGE_CACHE.clear()
        _MOD.PUB_LAST_GOOD.clear()
        _MOD.EDGE_LAST_GOOD.clear()
        _MOD.PUB_FAILS = 0
        _MOD.EDGE_FAILS = 0
        _MOD._PUB_BUSY = False

    def test_timeout_keeps_last_good(self):
        live = {"ok": True, "origin": "session", "n": 1, "mac_live": False}
        _MOD.apply_public_result(live, "pub")
        self.assertTrue(_MOD.PUB_CACHE.get("_lamp"))
        self.assertEqual(_MOD.PUB_LAST_GOOD.get("origin"), "session")
        out = _MOD.apply_public_result({"ok": False, "error": "timed out"}, "pub")
        self.assertEqual(_MOD.PUB_LAST_GOOD.get("origin"), "session")
        self.assertEqual(out.get("origin"), "session")
        self.assertTrue(out.get("_lamp"))
        self.assertEqual(_MOD.PUB_FAILS, 1)

    def test_three_fails_then_dark(self):
        _MOD.apply_public_result({"ok": True, "origin": "session", "n": 1, "mac_live": False}, "pub")
        for _ in range(3):
            _MOD.apply_public_result({"ok": False, "error": "timed out"}, "pub")
        self.assertEqual(_MOD.PUB_FAILS, 3)
        self.assertFalse(_MOD.PUB_CACHE.get("_lamp"))
        self.assertEqual(_MOD.PUB_CACHE.get("origin"), "session")
        self.assertEqual(_MOD.pub_origin_label(_MOD.PUB_CACHE), "session")

    def test_session_200_lamp_on(self):
        self.assertTrue(_MOD.public_http_ok({"origin": "session", "n": 1, "mac_live": False}))
        out = _MOD.apply_public_result({"origin": "session", "n": 1, "mac_live": False}, "pub")
        self.assertTrue(out.get("_lamp"))
        self.assertEqual(_MOD.pub_origin_label(out), "session")

    def test_decision_live_when_local_ok_pub_failed(self):
        self.assertEqual(_MOD.local_decision(True, True, "ALLOW"), "LIVE")
        self.assertNotEqual(_MOD.local_decision(True, True, "ALLOW"), "PUBLIC?")
        _MOD.apply_public_result({"ok": False, "error": "timed out"}, "pub")
        self.assertFalse(_MOD.PUB_CACHE.get("_lamp"))
        self.assertEqual(_MOD.local_decision(True, True, "ALLOW"), "LIVE")

    def test_header_live_when_host_cap_over_metabol_allow(self):
        self.assertEqual(_MOD.local_decision(True, True, "ALLOW"), "LIVE")

    def test_header_degraded_when_hop_ok_false(self):
        self.assertEqual(_MOD.local_decision(False, True, "ALLOW"), "DEGRADED")

    def test_header_hold_when_metabol_hold(self):
        self.assertEqual(_MOD.local_decision(True, True, "HOLD"), "HOLD")

    def test_draw_header_not_public_q(self):
        def local_get(url: str, timeout: float = 2.0) -> dict:
            if "8788/health" in url:
                return {"ok": True, "origin": "macbook", "n": 2, "mac_live": True}
            if "8787/status" in url:
                return {"status": "operational", "origin": "macbook", "host_cap": {}}
            return {"ok": False}

        _MOD.PUB_CACHE.update({"ok": False, "error": "timed out", "_lamp": False})
        _MOD.DEV_TTY = io.StringIO()
        _MOD.HELP = False
        with mock.patch.object(_MOD, "get", side_effect=local_get), mock.patch.object(
            _MOD, "sh", return_value=""
        ), mock.patch.object(_MOD, "kick_public_refresh", lambda: None):
            _MOD.draw("")
        painted = _MOD.DEV_TTY.getvalue()
        self.assertNotIn("PUBLIC?", painted)
        self.assertIn("LIVE", painted)


class HopMap(unittest.TestCase):
    def test_hop_map_file(self):
        text = (Path(__file__).resolve().parent / "hop-map.yml").read_text()
        self.assertIn("fog.calhegasmorais.pt", text)
        self.assertIn("origin.calhegasmorais.pt", text)
        self.assertIn("gossip.calhegasmorais.pt", text)
        self.assertIn("http://127.0.0.1:8788", text)
        self.assertIn("auth.calhegasmorais.pt", text)
        self.assertIn("mw.calhegasmorais.pt", text)
        self.assertIn("http://127.0.0.1:8790", text)
        self.assertIn("SIGHUP", text)
        self.assertIn("reload: SIGHUP", text)


if __name__ == "__main__":
    unittest.main()
