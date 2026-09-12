#!/usr/bin/env python3
import json
import tempfile
import unittest
from pathlib import Path
import os
import importlib.util

HERE = Path(__file__).resolve().parent


def _load():
    spec = importlib.util.spec_from_file_location("desk_mandate", HERE / "desk_mandate.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


class TestDeskMandate(unittest.TestCase):
    def setUp(self):
        self.mod = _load()
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["FOG_HOME"] = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def test_load_hermes_mandate(self):
        m = self.mod.load_mandate("hermes")
        self.assertEqual(m.get("schema"), "desk.mandate.v1")
        self.assertIn("Coordinate", m.get("purpose") or "")

    def test_bind_and_render(self):
        c = self.mod.bind_commitment("opencode", {
            "id": "dt-demo",
            "intent": "Patch desk needles with real edit",
            "specialty": "code",
        })
        self.assertEqual(c["task_id"], "dt-demo")
        brief = self.mod.render_directed_brief(c)
        self.assertIn("commitment", brief.lower())
        self.assertIn("dt-demo", brief)
        self.assertIn("Never", brief)

    def test_evidence_gate(self):
        c = self.mod.bind_commitment("openclaw", {"id": "dt-claw", "intent": "hop prove"})
        self.assertFalse(self.mod.evidence_matches_commitment("", c))
        self.assertTrue(self.mod.evidence_matches_commitment(
            "claw probe rc=0 fog=1 workerd=1 ws=1 wrote status/prove.txt", c))


if __name__ == "__main__":
    unittest.main()
