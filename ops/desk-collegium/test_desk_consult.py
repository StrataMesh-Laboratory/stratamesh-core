#!/usr/bin/env python3
"""Unit tests: private consult threads + opaque feed pointer + KPI wall."""
from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COLLEGIUM = Path(__file__).resolve().parent
BUS = COLLEGIUM / "desk_bus.py"
STORE = COLLEGIUM / "consult" / "store.py"


class DeskConsult(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-consult-"))
        self.env = os.environ.copy()
        self.env["FOG_HOME"] = str(self.tmp)
        d = self.tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        repo_state = json.loads((COLLEGIUM / "state.json").read_text(encoding="utf-8"))
        repo_state["open_tasks"] = []
        repo_state["done_tasks"] = []
        repo_state["last_commit"] = None
        (d / "state.json").write_text(json.dumps(repo_state, indent=2) + "\n", encoding="utf-8")
        (d / "consult").mkdir(parents=True, exist_ok=True)
        (d / "consult" / "index.json").write_text(
            json.dumps({"schema": "desk.consult.index.v0", "version": "0.1.0", "updated": None, "threads": {}}, indent=2)
            + "\n",
            encoding="utf-8",
        )

    def _store(self):
        import importlib.util
        os.environ["FOG_HOME"] = str(self.tmp)
        spec = importlib.util.spec_from_file_location("desk_consult_store_t", STORE)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        return mod

    def _run(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(BUS), *args],
            cwd=str(ROOT),
            env=self.env,
            capture_output=True,
            text=True,
        )

    def _feed(self) -> str:
        p = self.tmp / "data" / "desk-feed.jsonl"
        return p.read_text(encoding="utf-8") if p.is_file() else ""

    def test_open_reply_private_body_opaque_feed(self):
        secret = "SECRET_CONSULT_BODY_do_not_leak_to_feed"
        r = self._run(
            "consult",
            "--by", "opencode",
            "--to", "hermes",
            "--topic", "blocker",
            "--note", secret,
        )
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        data = json.loads(r.stdout.strip().splitlines()[-1])
        tid = data["out"]["thread"]["id"]
        self.assertTrue(tid.startswith("ct-"))
        r2 = self._run("consult", "--by", "hermes", "--thread", tid, "--note", "ack looking")
        self.assertEqual(r2.returncode, 0, r2.stderr + r2.stdout)
        feed = self._feed()
        self.assertIn("consult", feed)
        self.assertIn(tid, feed)
        self.assertNotIn(secret, feed)
        self.assertNotIn("ack looking", feed)
        mod = self._store()
        got = mod.read_thread(thread_id=tid, frm="hermes")
        self.assertTrue(got["ok"])
        bodies = [m["text"] for m in got["messages"]]
        self.assertIn(secret, bodies)
        self.assertIn("ack looking", bodies)

    def test_non_participant_cannot_reply(self):
        r = self._run("consult", "--by", "opencode", "--to", "hermes", "--note", "hi")
        tid = json.loads(r.stdout.strip().splitlines()[-1])["out"]["thread"]["id"]
        bad = self._run("consult", "--by", "openclaw", "--thread", tid, "--note", "intrude")
        self.assertNotEqual(bad.returncode, 0)

    def test_consult_close(self):
        r = self._run("consult", "--by", "hermes", "--to", "opencode", "--note", "q")
        tid = json.loads(r.stdout.strip().splitlines()[-1])["out"]["thread"]["id"]
        c = self._run("consult_close", "--by", "hermes", "--thread", tid, "--note", "done")
        self.assertEqual(c.returncode, 0, c.stderr)
        feed = self._feed()
        self.assertIn("consult_close", feed)
        again = self._run("consult", "--by", "opencode", "--thread", tid, "--note", "too late")
        self.assertNotEqual(again.returncode, 0)

    def test_kpi_wall(self):
        src = STORE.read_text(encoding="utf-8")
        tree = ast.parse(src)
        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    imported.add(a.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        self.assertTrue({"desk_metrics", "desk_ship"}.isdisjoint(imported))
        self.assertNotIn("desk-lab-progress", src)
        self.assertNotIn("update_lab_progress", src)


if __name__ == "__main__":
    unittest.main()
