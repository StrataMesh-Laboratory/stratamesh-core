#!/usr/bin/env python3
"""Wizard persist / composer / action allowlist + draw() must not block on public HTTP."""
from __future__ import annotations

import importlib.util
import io
import json
import os
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

_TMP = Path(tempfile.mkdtemp(prefix="fog-tui-wizard-"))
os.environ["FOG_HOME"] = str(_TMP)
os.environ["FOG_TUI_KEEP_STDERR"] = "1"
(_TMP / "data").mkdir(parents=True, exist_ok=True)

_SRC = Path(__file__).resolve().parent / "fog-tui.py"
_SPEC = importlib.util.spec_from_file_location("fog_tui_wizard", _SRC)
_MOD = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(_MOD)
_MOD.FOG = _TMP
_MOD.DEV_TTY = io.StringIO()


def _fast_get(url: str, timeout: float = 2.0) -> dict:
    return {"ok": False, "error": "offline"}


class WizardPersist(unittest.TestCase):
    def setUp(self):
        _MOD.HELP = True
        _MOD.WIZARD_INPUT = ""
        _MOD.WIZARD_BUSY = False
        _MOD.wizard_clear()
        _MOD.FOG = _TMP
        (_TMP / "data").mkdir(parents=True, exist_ok=True)

    def test_persist_survives_fake_draw_clear(self):
        _MOD.wizard_append("user", "keep-me")
        path = _MOD.wizard_json_path()
        self.assertTrue(path.is_file())
        n = len(_MOD.WIZARD_LOG)
        _MOD.DEV_TTY = io.StringIO()
        with mock.patch.object(_MOD, "get", side_effect=_fast_get), mock.patch.object(
            _MOD, "sh", return_value=""
        ), mock.patch.object(_MOD, "kick_public_refresh", lambda: None):
            _MOD.draw("frame")
        self.assertEqual(len(_MOD.WIZARD_LOG), n)
        self.assertEqual(_MOD.WIZARD_LOG[0]["text"], "keep-me")
        self.assertTrue(path.is_file())
        painted = _MOD.DEV_TTY.getvalue()
        self.assertIn("keep-me", painted)
        self.assertIn("wizard on", painted)

    def test_r_does_not_clear(self):
        _MOD.wizard_append("sys", "stay")
        _MOD.HELP = False
        self.assertFalse(_MOD.wizard_consume_key("r"))
        self.assertEqual(_MOD.WIZARD_LOG[0]["text"], "stay")

    def test_C_clears_log_and_json(self):
        _MOD.wizard_append("user", "bye")
        self.assertTrue(_MOD.wizard_json_path().is_file())
        self.assertTrue(_MOD.wizard_consume_key("C"))
        self.assertEqual(_MOD.WIZARD_LOG, [])
        self.assertFalse(_MOD.wizard_json_path().exists())
        self.assertEqual(_MOD.WIZARD_INPUT, "")

    def test_lowercase_c_is_composer_not_clear(self):
        self.assertTrue(_MOD.wizard_consume_key("c"))
        self.assertEqual(_MOD.WIZARD_INPUT, "c")
        self.assertEqual(_MOD.WIZARD_LOG, [])

    def test_composer_backspace(self):
        self.assertTrue(_MOD.wizard_consume_key("x"))
        self.assertTrue(_MOD.wizard_consume_key("z"))
        self.assertEqual(_MOD.WIZARD_INPUT, "xz")
        self.assertTrue(_MOD.wizard_consume_key("\x7f"))
        self.assertEqual(_MOD.WIZARD_INPUT, "x")
        self.assertTrue(_MOD.wizard_consume_key("\x08"))
        self.assertEqual(_MOD.WIZARD_INPUT, "")

    def test_g_not_stolen_into_composer(self):
        self.assertFalse(_MOD.wizard_consume_key("g"))
        self.assertEqual(_MOD.WIZARD_INPUT, "")
        self.assertFalse(_MOD.wizard_consume_key("s"))
        self.assertFalse(_MOD.wizard_consume_key("b"))
        self.assertFalse(_MOD.wizard_consume_key("?"))
        self.assertFalse(_MOD.wizard_consume_key("q"))


class WizardActions(unittest.TestCase):
    def setUp(self):
        _MOD.wizard_clear()
        _MOD.FOG = _TMP
        _MOD.git_pull_reboot = lambda: (_ for _ in ()).throw(AssertionError("git_pull"))
        _MOD.stop_fog = lambda: (_ for _ in ()).throw(AssertionError("stop"))
        _MOD.reboot_fog = lambda: (_ for _ in ()).throw(AssertionError("reboot"))

    def test_reject_pkill_cloudflared_workers(self):
        st, _ = _MOD.wizard_run_action("pkill cloudflared")
        self.assertEqual(st, "rejected")
        st, _ = _MOD.wizard_run_action("kill cloudflared")
        self.assertEqual(st, "rejected")
        st, _ = _MOD.wizard_run_action("curl https://x.workers.dev/path")
        self.assertEqual(st, "rejected")
        st, _ = _MOD.wizard_run_action("origin-take")
        self.assertEqual(st, "rejected")
        self.assertFalse(_MOD.wizard_action_allowed("ACTION:probe hops; pkill -9 cloudflared"))

    def test_suggest_g_does_not_exec_git(self):
        st, note = _MOD.wizard_run_action("suggest g")
        self.assertEqual(st, "ok")
        self.assertIn("will not run", note)
        st, note = _MOD.wizard_run_action("suggest s")
        self.assertEqual(st, "ok")
        st, note = _MOD.wizard_run_action("suggest b")
        self.assertEqual(st, "ok")

    def test_probe_hops_allowlisted(self):
        with mock.patch.object(_MOD, "get", side_effect=_fast_get):
            st, note = _MOD.wizard_run_action("probe hops")
        self.assertEqual(st, "ok")
        self.assertIn(":8788", note)


class DrawFast(unittest.TestCase):
    def test_public_hang_does_not_block_draw(self):
        calls = []

        def hanging_get(url: str, timeout: float = 2.0) -> dict:
            calls.append((threading.current_thread().name, url, timeout))
            if not _MOD.is_local_instrument_url(url):
                time.sleep(3.0)
            return {"ok": False, "error": "hang-public"}

        _MOD.DEV_TTY = io.StringIO()
        _MOD.HELP = False
        _MOD._PUB_BUSY = False
        t0 = time.monotonic()
        with mock.patch.object(_MOD, "get", side_effect=hanging_get), mock.patch.object(
            _MOD, "sh", return_value=""
        ):
            _MOD.draw("")
        elapsed = time.monotonic() - t0
        self.assertLess(elapsed, 1.0, "draw blocked %.2fs on public HTTP" % elapsed)
        fg = [c for c in calls if c[0] == threading.current_thread().name]
        self.assertTrue(fg)
        for _thr, url, timeout in fg:
            self.assertTrue(_MOD.is_local_instrument_url(url), url)
            self.assertLessEqual(timeout, 0.3 + 1e-9)
            self.assertNotIn("calhegasmorais.pt", url)
            self.assertNotIn("workers.dev", url)
        self.assertNotIn("status.calhegasmorais.pt", json.dumps(calls))

    def test_is_local_helper(self):
        self.assertTrue(_MOD.is_local_instrument_url("http://127.0.0.1:8788/health"))
        self.assertFalse(_MOD.is_local_instrument_url("https://fog.calhegasmorais.pt/health"))
        self.assertFalse(_MOD.is_local_instrument_url("https://status.calhegasmorais.pt/metabol"))


if __name__ == "__main__":
    unittest.main()
