#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
OPS = Path(__file__).resolve().parent / "desk_ops.py"


class DeskOps(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-ops-"))
        self.env = os.environ.copy()
        self.env["FOG_HOME"] = str(self.tmp)
        d = self.tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        state = {
            "schema": "desk.collegium.state.v1",
            "version": "0.2.1-lab",
            "members": [],
            "open_tasks": [
                {
                    "schema": "desk.task.v1",
                    "id": "dt-test-claw",
                    "owner": "openclaw@fog",
                    "specialty": "claw",
                    "intent": "probe",
                    "status": "constrain",
                    "constraints": [],
                    "result": "",
                    "sha": "",
                }
            ],
            "done_tasks": [],
            "lanes": {
                "lane-openclaw": {"pace": "ALLOW"},
                "lane-hermes": {"pace": "ALLOW"},
                "lane-opencode": {"pace": "ALLOW"},
                "lane-bot": {"pace": "HOLD"},
            },
        }
        (d / "state.json").write_text(json.dumps(state, indent=2) + "\n")

    def test_cycle_completes_claw(self):
        def fake_http(url, timeout=6.0):
            if "fog.calhegasmorais.pt" in url or "api-edge" in url:
                return True, "200:ok"
            return False, "down"

        # Patch inside desk_ops module via env runner: inject by rewriting is heavy;
        # instead monkeypatch by running with a wrapper — call cycle after patching import.
        import importlib.util
        spec = importlib.util.spec_from_file_location("desk_ops", OPS)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        mod._http_ok = fake_http  # type: ignore
        # Also avoid live /desk push
        mod._push = lambda bus: None  # type: ignore

        ns = type("A", (), {"max": 1, "dry_run": False})()
        # FOG_HOME for bus
        os.environ["FOG_HOME"] = str(self.tmp)
        rc = mod.cmd_cycle(ns)
        self.assertEqual(rc, 0)
        state = json.loads((self.tmp / "data/desk-collegium/state.json").read_text())
        open_ids = {t["id"] for t in state.get("open_tasks") or []}
        self.assertNotIn("dt-test-claw", open_ids)
        done_ids = {t["id"] for t in state.get("done_tasks") or []}
        self.assertIn("dt-test-claw", done_ids)


if __name__ == "__main__":
    unittest.main()
