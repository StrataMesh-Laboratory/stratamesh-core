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

PEER_VERBS = ("act", "audit", "amend", "revise", "refer", "dispute")


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

    def _state(self) -> dict:
        return json.loads((self.tmp / "data/desk-collegium/state.json").read_text())

    def _feed(self) -> str:
        return (self.tmp / "data/desk-feed.jsonl").read_text()

    def _propose(self) -> str:
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
        return tid

    def test_propose_constrain_done_and_feed(self):
        tid = self._propose()
        self.assertEqual(self._run("constrain", tid, "--by", "hermes", "--note", "ok").returncode, 0)
        self.assertEqual(
            self._run("commit", tid, "--by", "opencode", "--result", "landed", "--sha", "abc").returncode,
            0,
        )
        self.assertEqual(self._run("done", tid, "--by", "opencode", "--result", "verified").returncode, 0)
        state = self._state()
        self.assertEqual(state["open_tasks"], [])
        self.assertEqual(state["last_commit"]["id"], tid)
        feed = self._feed()
        self.assertIn("propose", feed)
        self.assertIn("done", feed)
        self.assertIn(tid, feed)
        # history on done task
        done = next(t for t in state["done_tasks"] if t["id"] == tid)
        verbs = [h.get("verb") for h in done.get("history") or []]
        self.assertIn("propose", verbs)
        self.assertIn("constrain", verbs)
        self.assertIn("done", verbs)

    def test_pulse_apply(self):
        r = self._run("pulse", "--apply")
        self.assertEqual(r.returncode, 0, r.stderr)
        state = self._state()
        specs = {t["specialty"] for t in state["open_tasks"]}
        self.assertTrue({"code", "claw", "coord"} <= specs)

    def test_peer_verbs_history_and_feed(self):
        """Each peer verb records history + DESK feed kind."""
        tid = self._propose()
        for verb in PEER_VERBS:
            note = f"{verb}-note"
            by = "opencode" if verb in ("amend", "revise", "act") else "hermes"
            args = [verb, tid, "--by", by, "--note", note]
            if verb in ("revise", "amend"):
                args += ["--intent", f"intent-after-{verb}"]
            r = self._run(*args)
            self.assertEqual(r.returncode, 0, f"{verb}: {r.stderr}")
            state = self._state()
            task = next(t for t in state["open_tasks"] if t["id"] == tid)
            verbs = [h.get("verb") for h in task.get("history") or []]
            self.assertIn(verb, verbs, f"history missing {verb}: {verbs}")
            self.assertEqual(task.get("status"), verb)
            feed = self._feed()
            self.assertIn(f'"{verb}"', feed)
            self.assertIn(tid, feed)
            self.assertIn(note, feed)

    def test_vote_call_and_cast(self):
        tid = self._propose()
        self.assertEqual(
            self._run("call-vote", tid, "--by", "hermes", "--note", "ship?").returncode,
            0,
        )
        self.assertEqual(
            self._run("cast", tid, "--by", "opencode", "--vote", "ack", "--note", "ok").returncode,
            0,
        )
        # alias path
        self.assertEqual(
            self._run("vote", tid, "--by", "openclaw", "--cast", "nack", "--note", "hold").returncode,
            0,
        )
        state = self._state()
        task = next(t for t in state["open_tasks"] if t["id"] == tid)
        self.assertEqual(task.get("status"), "vote")
        verbs = [h.get("verb") for h in task.get("history") or []]
        self.assertIn("call_vote", verbs)
        self.assertIn("cast", verbs)
        ballots = {v.get("by"): v.get("vote") for v in task.get("votes") or []}
        self.assertEqual(ballots.get("opencode"), "ack")
        self.assertEqual(ballots.get("openclaw"), "nack")
        feed = self._feed()
        self.assertIn('"vote"', feed)
        self.assertIn("cast ack", feed)
        self.assertIn("cast nack", feed)


if __name__ == "__main__":
    unittest.main()
