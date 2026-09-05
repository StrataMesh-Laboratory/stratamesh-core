#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent

def _load():
    spec = importlib.util.spec_from_file_location("desk_issues", HERE / "desk_issues.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod

class DeskIssues(unittest.TestCase):
    def test_ensure_dry_run(self):
        m = _load()
        m._gh_bin = lambda: None
        m._gh_issues = lambda limit=50: []
        ns = type("A", (), {"dry_run": True, "force": False})()
        rc = m.cmd_ensure(ns)
        self.assertEqual(rc, 0)

if __name__ == "__main__":
    unittest.main()
