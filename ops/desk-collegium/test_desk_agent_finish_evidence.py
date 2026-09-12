"""desk_agent_finish evidence must reject size-only / stub vapour (NO-FAKE-DONE)."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import desk_agent_finish as fin


class TestDeskAgentFinishEvidence(unittest.TestCase):
    def test_rejects_tiny_file(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "tiny.txt"
            p.write_text("ok done\n", encoding="utf-8")
            self.assertFalse(fin._evidence_ok(str(p)))

    def test_rejects_t1_verified_stub(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "stub.txt"
            p.write_text(
                "Evidence created:\n"
                "desk-meters/dt-proj-ts-taper-t1.txt contains:\n"
                "act t1 verified on 2026-09-12\n"
                "File written, verified, and ready for desk_agent_finish.py. "
                "No further changes needed.\n",
                encoding="utf-8",
            )
            self.assertFalse(fin._evidence_ok(str(p)))

    def test_accepts_real_mac_prove_body(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "prove.txt"
            p.write_text(
                "Mac T1 WG prove PASS: mac_addr=10.88.0.2 ping_10.88.0.1=True "
                "openvpn=True wrote desk-meters/wg-t1.json "
                "prove=status/t1-wg-mac-prove-20260912T183000Z.txt sha=2e05a12 "
                "| iphone_prove=false honest residual (not faked) "
                "| paid_seats=false operator_path=hermes-wg | refreshed=true rc=0\n",
                encoding="utf-8",
            )
            self.assertTrue(fin._evidence_ok(str(p)))


if __name__ == "__main__":
    unittest.main()
