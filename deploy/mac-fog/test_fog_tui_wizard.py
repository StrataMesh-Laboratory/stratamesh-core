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



class HopSparkHistory(unittest.TestCase):
    def test_always_live_is_ticks_not_fill_or_braille(self):
        s = _MOD.hop_spark([1.0] * 12)
        self.assertGreaterEqual(len(s), 8)
        self.assertLessEqual(len(s), 12)
        self.assertEqual(set(s), {":"})
        self.assertNotIn("\u28ff", s)
        self.assertNotIn("\u2800", s)
        self.assertNotIn("█", s)
        self.assertNotIn("░", s)

    def test_down_slice_is_gap_column(self):
        s = _MOD.hop_spark([1, 0, 1, 0, 1, 0, 1, 0])
        self.assertEqual(len(s), 8)
        self.assertEqual(s, ":.:.:.:.")

    def test_empty_is_gap_row(self):
        s = _MOD.hop_spark([])
        self.assertEqual(s, "." * 8)




class WizardFaqDocs(unittest.TestCase):
    def setUp(self):
        _MOD.WIZARD_DOCS = (
            "Fog kernel listens on :8787. "
            "Middleware hops are workerd, python, node, and deno (five slots). "
            "SCA (PT) and ACB (EN) name the same subject. "
            "HOLD is metabolic host_cap, not a CPU RCA. "
            "The subject-object economy treats labour as the subject."
        )
        _MOD.WIZARD_DOCS_LOADED = True

    def test_faq_improvise_uses_user_prompt_and_docs(self):
        snap = {
            "git": "69e7e94",
            "n": 2,
            "member": True,
            "host_cap_over": True,
            "hops": {"8788": True, "8787": True},
        }
        a = _MOD.wizard_faq_improvise("what is this runtime", snap)
        b = _MOD.wizard_faq_improvise("explain HOLD", snap)
        c = _MOD.wizard_faq_improvise("SCA ACB subject", snap)
        self.assertIn("Q: what is this runtime", a)
        self.assertIn("Q: explain HOLD", b)
        self.assertNotEqual(a, b)
        self.assertIn("8787", a)
        self.assertIn("kernel", a.lower())
        self.assertIn("HOLD", b)
        self.assertIn("host_cap", b)
        self.assertTrue("SCA" in c or "ACB" in c)
        self.assertNotIn("member=True", a)
        self.assertNotIn("cap_over=True", a)
        self.assertIn("hops git=69e7e94", a)
        self.assertIn(":8788=LIVE", a)

    def test_generate_timeout_at_least_60(self):
        self.assertGreaterEqual(_MOD.OLLAMA_GENERATE_TIMEOUT, 60.0)
        captured = {}

        class FakeResp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def __iter__(self):
                yield b'{"response":"hello from ollama","done":true}\n'

        def fake_urlopen(req, timeout=None):
            captured["timeout"] = timeout
            return FakeResp()

        with mock.patch.object(_MOD.urllib.request, "urlopen", side_effect=fake_urlopen):
            out = _MOD._ollama_generate_text("llama3.2:1b", "explain", {"git": "x"})
        self.assertGreaterEqual(float(captured.get("timeout") or 0), 60.0)
        self.assertEqual(out, "hello from ollama")
        self.assertNotIn("member=True", out)
        self.assertNotIn("cap_over", out)

    def test_preferred_hermes_then_llava_then_llama(self):
        with mock.patch.object(_MOD, "ollama_tag_names", return_value=["mistral:7b", "hermes3:3b", "llava"]):
            self.assertEqual(_MOD.ollama_preferred_tag(), "hermes3:3b")
        with mock.patch.object(_MOD, "ollama_tag_names", return_value=["mistral:7b", "llava"]):
            self.assertEqual(_MOD.ollama_preferred_tag(), "llava")
        with mock.patch.object(_MOD, "ollama_tag_names", return_value=["mistral:7b", "llama3.2:1b"]):
            self.assertEqual(_MOD.ollama_preferred_tag(), "llama3.2:1b")
        with mock.patch.object(_MOD, "ollama_tag_names", return_value=["phi3:mini"]):
            self.assertEqual(_MOD.ollama_preferred_tag(), "phi3:mini")




class DeskFeed(unittest.TestCase):
    def setUp(self):
        _MOD.FOG = _TMP
        (_TMP / "data").mkdir(parents=True, exist_ok=True)
        feed = _TMP / "data" / "desk-feed.jsonl"
        if feed.exists():
            feed.unlink()

    def test_append_and_tail(self):
        _MOD.desk_feed_append("hermes", "propose: patch feed", kind="propose", specialty="coord")
        _MOD.desk_feed_append("opencode", "constrain: ok", kind="constrain", specialty="code")
        rows = _MOD.desk_feed_tail(10)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["agent"], "hermes")
        self.assertEqual(rows[1]["kind"], "constrain")
        self.assertTrue((_TMP / "data" / "desk-feed.jsonl").is_file())

    def test_draw_desk_feed_empty_and_filled(self):
        _MOD.DEV_TTY = io.StringIO()
        # empty
        import sys
        buf = io.StringIO()
        with mock.patch("builtins.print", side_effect=lambda *a, **k: buf.write(" ".join(str(x) for x in a) + chr(10))):
            _MOD.draw_desk_feed(72, rows=8)
        out = buf.getvalue()
        self.assertIn("DESK", out)
        self.assertIn("waiting for desk agents", out)
        _MOD.desk_feed_append("openclaw", "local ws up", kind="say")
        buf2 = io.StringIO()
        with mock.patch("builtins.print", side_effect=lambda *a, **k: buf2.write(" ".join(str(x) for x in a) + "\n")):
            _MOD.draw_desk_feed(72, rows=8)
        out2 = buf2.getvalue()
        self.assertIn("openclaw", out2.lower())
        self.assertIn("local ws up", out2)

    def test_draw_includes_desk_section(self):
        _MOD.HELP = False
        _MOD.desk_feed_append("stratagrok", "Act: desk feed live", kind="say")
        _MOD.DEV_TTY = io.StringIO()
        with mock.patch.object(_MOD, "get", side_effect=_fast_get), mock.patch.object(
            _MOD, "sh", return_value=""
        ), mock.patch.object(_MOD, "kick_public_refresh", lambda: None):
            _MOD.draw("frame")
        painted = _MOD.DEV_TTY.getvalue()
        self.assertIn("DESK", painted)
        self.assertIn("desk feed live", painted)


    def test_kick_desk_refresh_defined(self):
        self.assertTrue(callable(getattr(_MOD, "kick_desk_refresh", None)))
        self.assertGreaterEqual(getattr(_MOD, "DESK_PROBE_PERIOD", 0), 60.0)

    def test_draw_desk_feed_shows_open_tasks(self):
        st = _TMP / "data" / "desk-collegium"
        st.mkdir(parents=True, exist_ok=True)
        import json
        (st / "state.json").write_text(json.dumps({
            "open_tasks": [{"id": "dt-needle", "owner": "opencode@fog", "status": "propose", "intent": "needle-intent"}],
            "lanes": {"lane-opencode": {"pace": "ALLOW"}},
        }))
        _MOD.FOG = _TMP
        buf = io.StringIO()
        with mock.patch("builtins.print", side_effect=lambda *a, **k: buf.write(" ".join(str(x) for x in a) + chr(10))):
            _MOD.draw_desk_feed(72, rows=8)
        out = buf.getvalue()
        self.assertIn("DESK", out)
        self.assertIn("dt-needle", out)
        self.assertIn("metabol", out)


if __name__ == "__main__":
    unittest.main()
