#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path
import os

HERE = Path(__file__).resolve().parent


def _load():
    spec = importlib.util.spec_from_file_location("desk_feed", HERE / "desk_feed.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


class TestSystemFeed(unittest.TestCase):
    def setUp(self):
        self.mod = _load()
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["FOG_HOME"] = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def test_append_system_no_agent(self):
        r = self.mod.append_system("reports gh_ok=1 discourse_ok=1", kind="sys")
        self.assertTrue(r.get("ok"))
        self.assertFalse(r.get("deduped"))
        rec = r["rec"]
        self.assertEqual(rec.get("source"), "system")
        self.assertEqual(rec.get("agent"), "")
        self.assertEqual(rec.get("kind"), "sys")
        self.assertNotEqual(rec.get("agent"), "stratagrok")
        self.assertNotEqual(rec.get("agent"), "desk")

    def test_desk_label_not_promoted_to_stratagrok(self):
        r = self.mod.append("desk", "surfaces ok", kind="act")
        rec = r["rec"]
        self.assertEqual(rec.get("source"), "system")
        self.assertEqual(rec.get("agent"), "")
        line = self.mod.format_line(rec["agent"], rec["kind"], rec["text"], source=rec.get("source"))
        self.assertIn("[sys]", line)
        self.assertNotIn("stratagrok", line)
        self.assertNotIn(" desk ", f" {line} ")

    def test_real_agent_untouched(self):
        r = self.mod.append("hermes", "act dt-x: evidence sha=abc", kind="act")
        rec = r["rec"]
        self.assertEqual(rec.get("agent"), "hermes")
        self.assertNotEqual(rec.get("source"), "system")


if __name__ == "__main__":
    unittest.main()
