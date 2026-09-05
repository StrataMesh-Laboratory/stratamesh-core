#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[2]
OPS = Path(__file__).resolve().parent / "desk_ops.py"


class DeskOps(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-ops-"))
        os.environ["FOG_HOME"] = str(self.tmp)
        d = self.tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        state = {
            "schema": "desk.collegium.state.v1",
            "version": "0.3.1-lab",
            "members": [],
            "open_tasks": [{
                "schema": "desk.task.v1",
                "id": "dt-test-claw",
                "owner": "openclaw@fog",
                "specialty": "claw",
                "intent": "probe",
                "status": "constrain",
                "constraints": [],
                "result": "",
                "sha": "",
            }],
            "done_tasks": [],
            "lanes": {
                "lane-openclaw": {"pace": "ALLOW"},
                "lane-hermes": {"pace": "ALLOW"},
                "lane-opencode": {"pace": "ALLOW"},
                "lane-bot": {"pace": "HOLD"},
                "lane-assistant": {"pace": "ALLOW"},
            },
        }
        (d / "state.json").write_text(json.dumps(state, indent=2) + "\n")

    def test_cycle_completes_claw(self):
        spec = importlib.util.spec_from_file_location("desk_ops", OPS)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        mod._http_ok = lambda url, timeout=6.0: (True, "200:ok")  # type: ignore
        mod._push = lambda bus: None  # type: ignore
        ns = type("A", (), {"max": 1, "dry_run": False})()
        rc = mod.cmd_cycle(ns)
        self.assertEqual(rc, 0)
        state = json.loads((self.tmp / "data/desk-collegium/state.json").read_text())
        self.assertNotIn("dt-test-claw", {t["id"] for t in state.get("open_tasks") or []})
        self.assertIn("dt-test-claw", {t["id"] for t in state.get("done_tasks") or []})
        # cycle must record last-cycle / metrics for Mac operative score
        metrics = self.tmp / "data" / "desk-metrics.jsonl"
        last = self.tmp / "data" / "last-cycle.jsonl"
        self.assertTrue(metrics.is_file(), "desk-metrics.jsonl missing after cycle")
        self.assertTrue(last.is_file(), "last-cycle.jsonl missing after cycle")
        row = json.loads(metrics.read_text().strip().splitlines()[-1])
        self.assertGreaterEqual(int(row.get("delivered") or 0), 1)
        self.assertTrue(row.get("protocol_ok"))


if __name__ == "__main__":
    unittest.main()
