#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location("desk_sync", Path(__file__).parent / "desk_sync.py")
_MOD = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(_MOD)


class MergeSafe(unittest.TestCase):
    def test_protected_not_overwritten(self):
        local = {
            "open_tasks": [
                {"id": "dt-1", "status": "commit", "intent": "local", "owner": "opencode"},
                {"id": "dt-2", "status": "propose", "intent": "local2", "owner": "hermes"},
            ],
            "members": [],
        }
        remote = {
            "open_tasks": [
                {"id": "dt-1", "status": "propose", "intent": "remote-clobber", "owner": "opencode"},
                {"id": "dt-3", "status": "propose", "intent": "new", "owner": "openclaw"},
            ],
            "members": [{"id": "hermes@fog", "pace": "HOLD"}],
        }
        out, notes = _MOD.merge_collegium(local, remote)
        by = {t["id"]: t for t in out["open_tasks"]}
        self.assertEqual(by["dt-1"]["status"], "commit")
        self.assertEqual(by["dt-1"]["intent"], "local")
        self.assertIn("dt-3", by)
        self.assertTrue(any("protected" in n for n in notes))


if __name__ == "__main__":
    unittest.main()
