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


    def test_rejects_confirm_chat_log(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "log.txt"
            p.write_text(
                "Would you like me to proceed? Please confirm.\n"
                "opencode run wrote log rc=0\n",
                encoding="utf-8",
            )
            self.assertFalse(fin._evidence_ok(str(p)))


    def test_forbids_done_when_evidence_done_false(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "status" / "t1-wg-mac-prove.txt"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(
                "task=dt-proj-ts-taper-t1\n"
                "mac_addr=10.88.0.2\n"
                "ping_10.88.0.1=true\n"
                "sha=deadbeef\n"
                "iphone_prove=false\n"
                "done=false\n"
                "NO_FAKE_DONE=true\n",
                encoding="utf-8",
            )
            self.assertEqual(
                fin._evidence_forbids_done(str(p), "residual", None),
                "evidence_says_done_false",
            )

    def test_forbids_done_t1_iphone_unproved(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "status" / "t1-prove.txt"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(
                "task=dt-proj-ts-taper-t1 mac_addr=10.88.0.2 "
                "ping_10.88.0.1=true sha=abc1234 iphone_prove=false\n",
                encoding="utf-8",
            )
            task = {
                "id": "dt-proj-ts-taper-t1",
                "intent": "Act T1 NOW: Mac+iPhone prove WG 10.88.0.0/24",
            }
            self.assertEqual(
                fin._evidence_forbids_done(str(p), "ok", task),
                "iphone_unproved_residual",
            )

    def test_accepts_overnight_residual_keys(self):
        """Overnight T1 residual uses mac_addr=/ping_10.88_/fog_local_ keys."""
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "status" / "t1-wg-mac-prove-residual.txt"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(
                "prove=t1-wg-mac\n"
                "task=dt-proj-ts-taper-t1\n"
                "NO_FAKE_DONE=1\n"
                "mac_addr=10.88.0.2\n"
                "mac_inet_present=true\n"
                "ping_10.88.0.1=true\n"
                "openvpn=true\n"
                "iphone_prove=false\n"
                "done=false\n"
                "fog_local_8787=200\n"
                "fog_public=200\n",
                encoding="utf-8",
            )
            self.assertTrue(fin._evidence_ok(str(p)))


if __name__ == "__main__":
    unittest.main()


class OpenClawHopEvidence(unittest.TestCase):
    def test_openclaw_hop_prove_markers(self):
        import desk_agent_finish as fin
        from pathlib import Path
        import tempfile
        blob = (
            "openclaw-hop-prove task=dt-ollama-claw-board\n"
            "git_head=abc1234\nsha=abc1234\nlocal8787=200\nprobe_rc=0\n"
            "claw probe local=1 workerd=1 ws=1 fog_public=1 edge_api=1 ok=1\n"
        )
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "status" / "openclaw-hop-prove-test.txt"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(blob * 3)  # ensure length
            self.assertTrue(fin._evidence_ok(str(p)))
