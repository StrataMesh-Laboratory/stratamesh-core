"""Ban skip-success / fake done in desk_ops."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
OPS = (ROOT / "desk_ops.py").read_text(encoding="utf-8")


class TestNoFakeDone(unittest.TestCase):
    def test_no_deferred_to_board_success(self):
        self.assertNotIn("deferred to board", OPS)

    def test_no_unittest_discover_pass_as_act(self):
        self.assertNotIn("unittest discover PASS", OPS)
        self.assertNotIn("_run_code_unittest_subset", OPS)

    def test_honest_result_helper_exists(self):
        self.assertIn("def honest_result(", OPS)
        self.assertIn(
            "NO FAKE DONE",
            (ROOT / "NO-FAKE-DONE.md").read_text(encoding="utf-8"),
        )

    def test_handler_code_refuses_unittest_substitute(self):
        self.assertIn("no unittest substitute", OPS)
        self.assertIn("not a code Act (self-audit label)", OPS)

    def test_handler_claw_and_code_return_evidence_flag(self):
        """Success and failure paths must mirror handler_coord evidence bool."""
        self.assertIn('"evidence": bool(evidence)', OPS)
        # both claw and code main returns carry the flag (coord already does)
        claw_idx = OPS.find("def handler_claw(")
        code_idx = OPS.find("def handler_code(")
        coord_idx = OPS.find("def handler_coord(")
        self.assertGreater(claw_idx, 0)
        self.assertGreater(code_idx, 0)
        self.assertGreater(coord_idx, 0)
        claw_body = OPS[claw_idx:code_idx]
        code_body = OPS[code_idx:OPS.find("def handler_lead(")]
        self.assertIn('"evidence": bool(evidence)', claw_body)
        self.assertIn('"evidence": bool(evidence)', code_body)

    def test_has_tool_evidence_no_soft_chrome_accept(self):
        """Reject ok+evidence wallpaper and openclaw session chrome as sole evidence."""
        # Removed soft accepts that treated JSON wallpaper / session chrome as True.
        self.assertNotIn('"ok": true\' in low and \'"evidence"\' in low', OPS)
        self.assertNotIn(
            'if "openclaw agent" in low and ("session_id" in low or "rc=" in low)',
            OPS,
        )

    def test_ensure_ollama_specialists_helper_exists(self):
        self.assertIn("def _ensure_ollama_specialists_on_board(", OPS)
        self.assertIn("_ensure_ollama_specialists_on_board(bus, state)", OPS)

    def test_pace_skip_uses_honest_result_not_ok_true(self):
        self.assertNotIn(
            '{"ok": True, "skipped": True, "pace": pace, "result": f"skip {pace}"}',
            OPS,
        )
        self.assertIn('result=f"skip {pace}"', OPS)
        # specialty_self_audit pace skip must go through honest_result
        audit_idx = OPS.find("def specialty_self_audit_tick(")
        self.assertGreater(audit_idx, 0)
        audit_body = OPS[audit_idx:OPS.find("def ensure_desk_surfaces_tick(")]
        self.assertIn("honest_result(", audit_body)
        self.assertIn("skipped=True", audit_body)
        self.assertIn('verb="refer"', audit_body)

    def test_agent_run_does_not_stamp_binary_present_ok(self):
        sh = (ROOT.parents[1] / "deploy" / "mac-fog" / "desk-agent-run.sh").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("binary_present", sh)
        self.assertIn("desk_agent_finish.py", sh)
        self.assertNotIn("serialized=True", sh)


if __name__ == "__main__":
    unittest.main()
