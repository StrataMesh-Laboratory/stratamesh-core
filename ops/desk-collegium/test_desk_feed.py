#!/usr/bin/env python3
"""desk_feed: collegium verbs + digest dedupe."""
from __future__ import annotations

import json
import os
import tempfile
import time
import unittest
from pathlib import Path
import importlib.util

HERE = Path(__file__).resolve().parent


def _load():
    spec = importlib.util.spec_from_file_location("desk_feed", HERE / "desk_feed.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class DeskFeed(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-feed-"))
        os.environ["FOG_HOME"] = str(self.tmp)
        self.mod = _load()

    def test_say_coerced_to_act(self):
        self.assertEqual(self.mod.normalize_kind("say"), "act")
        self.assertEqual(self.mod.normalize_kind("audit"), "audit")
        self.assertEqual(self.mod.normalize_kind("dispute"), "dispute")

    def test_format_line_explainable(self):
        line = self.mod.format_line(
            "openclaw", "audit",
            "hops fog=1 edge=1 :8787=1 | tokens 2100/33000",
            t="03:17:05",
        )
        self.assertIn("03:17:05", line)
        self.assertIn("openclaw", line)
        self.assertIn("audit", line)
        self.assertIn("fog=1", line)
        self.assertNotIn(" say ", f" {line} ")

    def test_dedupe_identical_within_window(self):
        fog = self.tmp
        a = self.mod.append(
            "desk", "surfaces TODO+CONTEXT+reports+journals ok",
            kind="act", specialty="coord", fog=fog, dedupe_sec=300,
        )
        self.assertFalse(a.get("deduped"))
        b = self.mod.append(
            "desk", "surfaces TODO+CONTEXT+reports+journals ok",
            kind="act", specialty="coord", fog=fog, dedupe_sec=300,
        )
        self.assertTrue(b.get("deduped"))
        feed = (fog / "data/desk-feed.jsonl").read_text().strip().splitlines()
        self.assertEqual(len(feed), 1)

    def test_delta_emits(self):
        fog = self.tmp
        self.mod.append("openclaw", "hops fog=0", kind="audit", fog=fog, dedupe_sec=300)
        self.mod.append("openclaw", "hops fog=1", kind="audit", fog=fog, dedupe_sec=300)
        feed = (fog / "data/desk-feed.jsonl").read_text().strip().splitlines()
        self.assertEqual(len(feed), 2)
        kinds = [json.loads(x)["kind"] for x in feed]
        self.assertEqual(kinds, ["audit", "audit"])

    def test_claw_payload(self):
        p = self.mod.claw_payload(fog_public=1, edge=1, local8787=1, tokens_used=2100, tokens_limit=33000)
        self.assertIn("fog=1", p)
        self.assertIn("tokens 2100/33000", p)


if __name__ == "__main__":
    unittest.main()
