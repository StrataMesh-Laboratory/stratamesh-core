#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location("desk_metabol", Path(__file__).parent / "desk_metabol.py")
_MOD = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(_MOD)


class DeskMetabol(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-met-"))
        os.environ["FOG_HOME"] = str(self.tmp)
        _MOD.FOG = self.tmp
        (self.tmp / "data/desk-collegium").mkdir(parents=True)
        (self.tmp / "data/desk-meters").mkdir(parents=True)
        state = {
            "schema": "desk.collegium.state.v1",
            "members": [
                {"id": "hermes@fog", "lane": "lane-hermes", "pace": "ALLOW", "specialty": "coord"},
                {"id": "openclaw@fog", "lane": "lane-openclaw", "pace": "ALLOW", "specialty": "claw"},
            ],
            "open_tasks": [
                {"id": "dt-test1", "owner": "opencode@fog", "status": "propose", "intent": "needle", "specialty": "code"},
            ],
        }
        (self.tmp / "data/desk-collegium/state.json").write_text(json.dumps(state))
        (self.tmp / "data/desk-meters/openclaw.json").write_text(
            json.dumps({"tokens_used": 2100, "tokens_limit": 33000, "model": "llava:latest"})
        )

    def test_tick_sets_lanes_and_mirrors_feed(self):
        out = _MOD.tick()
        self.assertTrue(out["ok"])
        self.assertEqual(out["lanes"]["lane-openclaw"], "ALLOW")
        self.assertGreaterEqual(out["mirrored"], 1)
        feed = (self.tmp / "data/desk-feed.jsonl").read_text()
        self.assertIn("dt-test1", feed)
        state = json.loads((self.tmp / "data/desk-collegium/state.json").read_text())
        self.assertIn("lanes", state)
        self.assertEqual(state["lanes"]["lane-openclaw"]["renewal"], "session_or_model_reload")

    def test_openclaw_hold_at_80pct(self):
        (self.tmp / "data/desk-meters/openclaw.json").write_text(
            json.dumps({"tokens_used": 28000, "tokens_limit": 33000})
        )
        out = _MOD.tick()
        self.assertEqual(out["lanes"]["lane-openclaw"], "HOLD")


if __name__ == "__main__":
    unittest.main()
