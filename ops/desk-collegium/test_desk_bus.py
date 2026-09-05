#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUS = Path(__file__).resolve().parent / "desk_bus.py"


class DeskBus(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-bus-"))
        self.env = os.environ.copy()
        self.env["FOG_HOME"] = str(self.tmp)
        # Fresh Mac bus: members from repo, no open tasks
        d = self.tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        repo = json.loads((ROOT / "ops" / "desk-collegium" / "state.json").read_text())
        repo["open_tasks"] = []
        repo["done_tasks"] = []
        repo["last_commit"] = None
        (d / "state.json").write_text(json.dumps(repo, indent=2) + chr(10), encoding="utf-8")

    def _run(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(BUS), *args],
            cwd=str(ROOT),
            env=self.env,
            capture_output=True,
            text=True,
        )

    def test_propose_constrain_done_and_feed(self):
        r = self._run(
            "propose",
            "--owner",
            "opencode",
            "--specialty",
            "code",
            "--intent",
            "unit test task",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        tid = r.stdout.strip().splitlines()[-1]
        self.assertTrue(tid.startswith("dt-"))
        self.assertEqual(self._run("constrain", tid, "--by", "hermes", "--note", "ok").returncode, 0)
        self.assertEqual(
            self._run("commit", tid, "--by", "opencode", "--result", "landed", "--sha", "abc").returncode,
            0,
        )
        self.assertEqual(self._run("done", tid, "--by", "opencode", "--result", "verified").returncode, 0)
        state = json.loads((self.tmp / "data/desk-collegium/state.json").read_text())
        self.assertEqual(state["open_tasks"], [])
        self.assertEqual(state["last_commit"]["id"], tid)
        feed = (self.tmp / "data/desk-feed.jsonl").read_text()
        self.assertIn("propose", feed)
        self.assertIn("done", feed)
        self.assertIn(tid, feed)

    def test_pulse_apply(self):
        r = self._run("pulse", "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        state = json.loads((self.tmp / "data/desk-collegium/state.json").read_text())
        specs = {t["specialty"] for t in state["open_tasks"]}
        self.assertTrue({"code", "claw", "coord"} <= specs)


if __name__ == "__main__":
    unittest.main()
