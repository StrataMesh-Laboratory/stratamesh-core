"""NO-FAKE-DONE: stub IPFS + metabol_unavailable fail-closed."""
from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"


class TestIpfsStubHold(unittest.TestCase):
    def test_stub_request_pin_is_hold_not_pinned(self):
        import sys
        if str(SRC) not in sys.path:
            sys.path.insert(0, str(SRC))
        from ipfs_client import IPFSClient

        with tempfile.TemporaryDirectory() as td:
            db = str(Path(td) / "pins.db")
            c = IPFSClient(mode="stub", db_path=db)
            rec = c.request_pin("bafy-nofake-hold")
            self.assertEqual(rec.status, "hold")
            self.assertIn("stub", (rec.last_error or "").lower())
            s = c.summary()
            self.assertEqual(s["mode"], "stub")
            self.assertEqual(s["decision"], "HOLD")
            self.assertTrue(s["sample_unknown"])
            self.assertFalse(s["live"])
            self.assertNotEqual(s.get("by_status", {}).get("pinned"), 1)


class TestPlatformAllowsFailClosed(unittest.TestCase):
    def test_metabol_unavailable_is_hold(self):
        path = Path(__file__).resolve().parent / "desk_ops.py"
        spec = importlib.util.spec_from_file_location("desk_ops_nfd", path)
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        with mock.patch.object(mod, "_load", side_effect=RuntimeError("boom")):
            ok, pace, why = mod._platform_allows({}, "cf-workers", action="worker")
        self.assertFalse(ok)
        self.assertEqual(pace, "HOLD")
        self.assertIn("metabol_unavailable", why)


if __name__ == "__main__":
    unittest.main()
