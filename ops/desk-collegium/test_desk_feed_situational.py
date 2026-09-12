#!/usr/bin/env python3
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


class TestSituational(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["FOG_HOME"] = self.tmp.name
        fog = Path(self.tmp.name)
        (fog / "data").mkdir(parents=True)
        feed = fog / "data" / "desk-feed.jsonl"
        rows = [
            {"t": "10:00:01", "agent": "hermes", "kind": "act", "text": "hermes did A"},
            {"t": "10:00:02", "agent": "", "kind": "sys", "source": "system", "text": "pull /desk ok"},
            {"t": "10:00:03", "agent": "openclaw", "kind": "done", "text": "claw probe fog=1"},
            {"t": "10:00:04", "agent": "hermes", "kind": "revise", "text": "hermes revise B"},
            {"t": "10:00:05", "agent": "opencode", "kind": "dispute", "text": "opencode chrome only"},
        ]
        feed.write_text(chr(10).join(json.dumps(r) for r in rows) + chr(10))
        self.feed = _load("desk_feed")

    def tearDown(self):
        self.tmp.cleanup()

    def test_annex_own_and_peers_excludes_system(self):
        text = self.feed.situational_annex("hermes")
        self.assertIn("hermes did A", text)
        self.assertIn("hermes revise B", text)
        self.assertIn("openclaw", text)
        self.assertIn("opencode", text)
        self.assertNotIn("pull /desk", text)
        self.assertIn("Situational feed", text)

    def test_brief_includes_feed(self):
        m = _load("desk_mandate")
        c = m.bind_commitment("hermes", {"id": "dt-x", "intent": "test feed annex"})
        brief = m.render_directed_brief(c)
        self.assertIn("Situational feed", brief)
        self.assertIn("commitment", brief.lower())


if __name__ == "__main__":
    unittest.main()
