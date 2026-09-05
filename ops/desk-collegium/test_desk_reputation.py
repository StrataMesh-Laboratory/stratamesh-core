#!/usr/bin/env python3
"""Unit tests: qualitative reputation v0 — self-ignore, feed verbs, KPI wall."""
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
REP_DIR = COLLEGIUM / "reputation"
STORE = REP_DIR / "store.py"


class DeskReputation(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-rep-"))
        self.env = os.environ.copy()
        self.env["FOG_HOME"] = str(self.tmp)
        d = self.tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        repo_state = json.loads((COLLEGIUM / "state.json").read_text(encoding="utf-8"))
        repo_state["open_tasks"] = []
        repo_state["done_tasks"] = []
        repo_state["last_commit"] = None
        (d / "state.json").write_text(json.dumps(repo_state, indent=2) + "\n", encoding="utf-8")
        # isolate reputation live dir
        (d / "reputation").mkdir(parents=True, exist_ok=True)
        (d / "reputation" / "reputation.json").write_text(
            json.dumps({"schema": "desk.reputation.v0", "version": "0.1.0", "updated": None, "notes": []}, indent=2)
            + "\n",
            encoding="utf-8",
        )
        sys.path.insert(0, str(COLLEGIUM))

    def _store(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location("desk_rep_store", STORE)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        # ensure FOG_HOME is active before load
        os.environ["FOG_HOME"] = str(self.tmp)
        spec.loader.exec_module(mod)
        return mod

    def _run_bus(self, *args: str) -> subprocess.CompletedProcess:
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

    def test_write_ignores_self(self):
        mod = self._store()
        out = mod.write_note(
            frm="hermes",
            to="hermes",
            skill_tags=["craft:coord"],
            qualitative=["self praise"],
        )
        self.assertTrue(out.get("ok"))
        self.assertEqual(out.get("skipped"), "self")
        store = mod.load_store()
        self.assertEqual(store.get("notes"), [])

    def test_commend_writes_peer_note(self):
        mod = self._store()
        out = mod.commend(
            frm="hermes",
            to="opencode",
            skill_tags=["craft:fog-tui", "stance:teaches"],
            qualitative=["clear patch trail"],
        )
        self.assertTrue(out.get("ok"))
        self.assertNotEqual(out.get("skipped"), "self")
        store = mod.load_store()
        notes = store.get("notes") or []
        self.assertEqual(len(notes), 1)
        n = notes[0]
        self.assertEqual(n["from"], "hermes")
        self.assertEqual(n["to"], "opencode")
        self.assertIn("craft:fog-tui", n["skill_tags"])
        self.assertTrue(n["qualitative"])
        # no numeric score fields
        self.assertNotIn("score", n)
        self.assertNotIn("rating", n)

    def test_ask_help_and_commend_feed_verbs(self):
        r = self._run_bus(
            "ask_help",
            "--by",
            "opencode",
            "--to",
            "hermes",
            "--tags",
            "craft:coord",
            "--note",
            "need bus refer trail",
        )
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        r2 = self._run_bus(
            "commend",
            "--by",
            "hermes",
            "--to",
            "opencode",
            "--tags",
            "craft:code",
            "stance:owns-blocker",
            "--note",
            "solid unittest hygiene",
        )
        self.assertEqual(r2.returncode, 0, r2.stderr + r2.stdout)
        feed = self._feed()
        self.assertIn("ask_help", feed)
        self.assertIn("commend", feed)
        mod = self._store()
        notes = mod.load_store().get("notes") or []
        self.assertTrue(any(n.get("to") == "opencode" and n.get("from") == "hermes" for n in notes))

    def test_kpi_wall_no_metrics_import_or_write(self):
        """Reputation module must not import/write lab-progress metrics."""
        src = STORE.read_text(encoding="utf-8")
        tree = ast.parse(src)
        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    imported.add(a.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imported.add(node.module.split(".")[0])
        forbidden = {"desk_metrics", "desk_ship", "desk_metabol"}
        self.assertTrue(forbidden.isdisjoint(imported), f"forbidden imports: {imported & forbidden}")
        self.assertNotIn("desk-lab-progress", src)
        self.assertNotIn("lab.progress", src)
        self.assertNotIn("ship_live", src)
        self.assertNotIn("update_lab_progress", src)
        # behavioral: commend must not create/update lab-progress under FOG_HOME or repo status
        mod = self._store()
        mod.commend(frm="openclaw", to="fog-assistant", skill_tags=["craft:origin-put"], note="good hops")
        progress_candidates = [
            self.tmp / "status" / "desk-lab-progress.json",
            ROOT / "status" / "desk-lab-progress.json",
        ]
        # Ensure module did not write a new progress file under FOG_HOME
        self.assertFalse((self.tmp / "status" / "desk-lab-progress.json").exists())
        # And store path stays under reputation/
        store_path = mod.aggregate_path()
        self.assertIn("reputation", str(store_path))

    def test_rank_helpers_soft_never_drops(self):
        mod = self._store()
        mod.commend(
            frm="stratagrok",
            to="opencode",
            skill_tags=["craft:code", "craft:fog-tui"],
            note="recent craft",
        )
        roles = {
            "members": [
                {"id": "hermes", "specialty": "coord", "skills": ["craft:coord"], "will_help": ["craft:coord"]},
                {"id": "opencode", "specialty": "code", "skills": ["craft:code"], "will_help": ["craft:code", "craft:fog-tui"]},
                {"id": "openclaw", "specialty": "claw", "skills": ["craft:hops"], "will_help": ["craft:hops"]},
            ]
        }
        ranked = mod.rank_helpers(
            task_tags=["craft:code"],
            specialty="code",
            candidates=["hermes", "opencode", "openclaw"],
            roles=roles,
        )
        ids = [r["id"] for r in ranked]
        self.assertEqual(set(ids), {"hermes", "opencode", "openclaw"})
        self.assertEqual(ids[0], "opencode")


if __name__ == "__main__":
    unittest.main()
