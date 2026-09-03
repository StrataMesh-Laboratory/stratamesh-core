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
        self.assertIn("TAB clear chat", painted)

    def test_r_does_not_clear(self):
        _MOD.wizard_append("sys", "stay")
        _MOD.HELP = False
        self.assertFalse(_MOD.wizard_consume_key("r"))
        self.assertEqual(_MOD.WIZARD_LOG[0]["text"], "stay")

    def test_TAB_clears_log_and_json(self):
        _MOD.wizard_append("user", "bye")
        self.assertTrue(_MOD.wizard_json_path().is_file())
        self.assertEqual(_MOD.wizard_consume_key("\t"), "clear")
        self.assertEqual(_MOD.WIZARD_LOG, [])
        self.assertFalse(_MOD.wizard_json_path().exists())
        self.assertEqual(_MOD.WIZARD_INPUT, "")

    def test_TAB_clears_when_help_false(self):
        _MOD.HELP = False
        _MOD.wizard_append("user", "gone")
        _MOD.WIZARD_INPUT = "partial"
        self.assertEqual(_MOD.wizard_consume_key("\t"), "clear")
        self.assertEqual(_MOD.WIZARD_LOG, [])
        self.assertEqual(_MOD.WIZARD_INPUT, "")

    def test_C_does_not_clear(self):
        _MOD.wizard_append("user", "keep")
        with unittest.mock.patch.object(_MOD, "wizard_clear") as clr:
            tok = _MOD.wizard_consume_key("C")
        clr.assert_not_called()
        self.assertEqual(tok, "type")
        self.assertEqual(_MOD.WIZARD_INPUT, "C")
        self.assertEqual(_MOD.WIZARD_LOG[0]["text"], "keep")

    def test_lowercase_c_is_composer_not_clear(self):
        with unittest.mock.patch.object(_MOD, "wizard_clear") as clr:
            self.assertEqual(_MOD.wizard_consume_key("c"), "type")
        clr.assert_not_called()
        self.assertEqual(_MOD.WIZARD_INPUT, "c")
        self.assertEqual(_MOD.WIZARD_LOG, [])

    def test_composer_backspace(self):
        self.assertEqual(_MOD.wizard_consume_key("x"), "type")
        self.assertEqual(_MOD.wizard_consume_key("z"), "type")
        self.assertEqual(_MOD.WIZARD_INPUT, "xz")
        self.assertEqual(_MOD.wizard_consume_key("\x7f"), "type")
        self.assertEqual(_MOD.WIZARD_INPUT, "x")
        self.assertEqual(_MOD.wizard_consume_key("\x08"), "type")
        self.assertEqual(_MOD.WIZARD_INPUT, "")

    def test_g_types_while_help_does_not_imply_git(self):
        self.assertEqual(_MOD.wizard_consume_key("g"), "type")
        self.assertEqual(_MOD.WIZARD_INPUT, "g")
        self.assertEqual(_MOD.wizard_consume_key("s"), "type")
        self.assertEqual(_MOD.wizard_consume_key("b"), "type")
        self.assertEqual(_MOD.wizard_consume_key("q"), "type")
        self.assertEqual(_MOD.wizard_consume_key("r"), "type")
        self.assertEqual(_MOD.wizard_consume_key("1"), "type")
        self.assertEqual(_MOD.WIZARD_INPUT, "gsbqr1")

    def test_question_and_esc_leave_help(self):
        self.assertEqual(_MOD.wizard_consume_key("?"), "leave")
        self.assertEqual(_MOD.WIZARD_INPUT, "")
        self.assertEqual(_MOD.wizard_consume_key("\x1b"), "leave")

    def test_dashboard_keys_when_help_false(self):
        _MOD.HELP = False
        self.assertFalse(_MOD.wizard_consume_key("g"))
        self.assertFalse(_MOD.wizard_consume_key("s"))
        self.assertFalse(_MOD.wizard_consume_key("b"))
        self.assertFalse(_MOD.wizard_consume_key("q"))
        self.assertFalse(_MOD.wizard_consume_key("r"))
        self.assertFalse(_MOD.wizard_consume_key("?"))
        self.assertFalse(_MOD.wizard_consume_key("C"))


class ComposerPaint(unittest.TestCase):
    def setUp(self):
        _MOD.HELP = True
        _MOD.WIZARD_INPUT = "hi"
        _MOD.WIZARD_BUSY = False
        _MOD.COMPOSER_ROW = 12
        _MOD.DEV_TTY = io.StringIO()

    def test_paint_composer_no_full_refresh(self):
        _MOD.paint_composer()
        out = _MOD.DEV_TTY.getvalue()
        self.assertIn("\033[12;1H", out)
        self.assertIn("\033[2K", out)
        self.assertIn(">", out)
        self.assertIn("hi", out)
        self.assertNotIn("\033[H", out.replace("\033[12;1H", ""))
        self.assertNotIn("\033[J", out)

    def test_enter_send_token(self):
        with unittest.mock.patch.object(_MOD, "wizard_send") as send:
            self.assertEqual(_MOD.wizard_consume_key("\r"), "send")
        send.assert_called_once()


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



class OrchAiopsReport(unittest.TestCase):
    def test_post_404_on_live_hop_is_not_chain_fail(self):
        def fake(url: str, method: str = "GET", data=None, timeout: float = 4.0):
            if url.endswith("/api/orchestrator/chat") and method == "POST" and "127.0.0.1" in url:
                return {"ok": False, "error": "not found", "_http": 404}
            if url.endswith("/health") and "127.0.0.1" in url:
                return {"ok": True, "listening": True, "_http": 200}
            if "calhegasmorais.pt" in url and method == "GET":
                return {
                    "status": "ok",
                    "service": "stratamesh-orchestrator",
                    "version": "origin-orch-chat-1.1.1",
                    "_http": 200,
                }
            if "calhegasmorais.pt" in url and method == "POST":
                return {"ok": False, "error": "Method Not Allowed", "_http": 405}
            return {"ok": False, "error": "no", "_http": 0}

        with mock.patch.object(_MOD, "_http_json", side_effect=fake):
            note = _MOD.orch_aiops_report("status", "faq", {})
        self.assertIn("orch-aiops", note)
        self.assertIn("hop-live", note)
        self.assertNotIn("8791 fail", note)
        self.assertNotIn("8790 fail", note)
        self.assertNotIn("calhegasmorais.pt fail", note)
        self.assertIn("origin GET ok", note)

    def test_local_post_200_stops_chain(self):
        def fake(url: str, method: str = "GET", data=None, timeout: float = 4.0):
            if url == "http://127.0.0.1:8791/api/orchestrator/chat" and method == "POST":
                return {"ok": True, "accepted": True, "_http": 200, "hop": "node:8791"}
            return {"ok": False, "error": "should-not-hit", "_http": 0}

        with mock.patch.object(_MOD, "_http_json", side_effect=fake) as m:
            note = _MOD.orch_aiops_report("h", "b", {})
        self.assertIn("8791 POST 200", note)
        self.assertIn("orch-aiops ok", note)
        urls = [c.args[0] for c in m.call_args_list]
        self.assertTrue(all("calhegasmorais.pt" not in u for u in urls))
        self.assertTrue(all("aiops" not in u for u in urls))



if __name__ == "__main__":
    unittest.main()
