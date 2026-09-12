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

    def test_agent_run_does_not_stamp_binary_present_ok(self):
        sh = (ROOT.parents[1] / "deploy" / "mac-fog" / "desk-agent-run.sh").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("binary_present", sh)
        self.assertIn("desk_agent_finish.py", sh)
        self.assertNotIn("serialized=True", sh)


if __name__ == "__main__":
    unittest.main()
