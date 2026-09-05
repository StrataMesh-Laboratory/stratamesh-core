#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _load():
    spec = importlib.util.spec_from_file_location("desk_connectors", HERE / "desk_connectors.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class DeskConnectors(unittest.TestCase):
    def test_gh_missing_soft(self):
        m = _load()
        m._resolve_gh = lambda: None  # type: ignore
        st = m._probe_gh(["gh", "auth", "status"])
        self.assertEqual(st, "missing")  # soft — not error

    def test_sdk_paths_include_metrics_ops(self):
        m = _load()
        reg = m.load_registry()
        sdk = next(s for s in reg["surfaces"] if s["id"] == "desk-sdk-cli")
        paths = sdk["probe"]["paths"]
        self.assertIn("ops/desk-collegium/desk_metrics.py", paths)
        self.assertIn("ops/desk-collegium/desk_ops.py", paths)
        row = m.probe_surface(sdk)
        self.assertEqual(row["status"], "present")

    def test_agent_run_surface_present(self):
        m = _load()
        reg = m.load_registry()
        surf = next(s for s in reg["surfaces"] if s["id"] == "desk-agent-run")
        row = m.probe_surface(surf)
        self.assertEqual(row["status"], "present")


if __name__ == "__main__":
    unittest.main()
