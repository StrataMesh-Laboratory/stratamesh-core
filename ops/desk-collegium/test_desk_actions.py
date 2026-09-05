#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import tempfile
import unittest
from pathlib import Path
import os

HERE = Path(__file__).resolve().parent


class DeskActions(unittest.TestCase):
    def test_gh_missing_soft(self):
        spec = importlib.util.spec_from_file_location("desk_actions", HERE / "desk_actions.py")
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader
        spec.loader.exec_module(mod)
        mod._gh_bin = lambda: None  # type: ignore
        tmp = Path(tempfile.mkdtemp())
        os.environ["FOG_HOME"] = str(tmp)
        # minimal bus state
        d = tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        (d / "state.json").write_text('{"schema":"desk.collegium.state.v1","open_tasks":[],"done_tasks":[]}\n')
        ns = type("A", (), {"limit": 5, "dry_run": False})()
        rc = mod.cmd_sync(ns)
        self.assertEqual(rc, 0)  # soft fail


if __name__ == "__main__":
    unittest.main()
