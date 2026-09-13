#!/usr/bin/env python3
import unittest
import desk_mandate as dm

class EvidenceGate(unittest.TestCase):
    def test_academy_live_passes_default_done_when(self):
        blob = "academy_teach live=1 students=SCA/ACB teachers=desk wrote desk-meters/academy-teach.json"
        self.assertTrue(dm.evidence_matches_commitment(blob, {"done_when": ["non-empty evidence path in result"]}))

    def test_empty_fails(self):
        self.assertFalse(dm.evidence_matches_commitment("", {"done_when": ["non-empty evidence path in result"]}))

    def test_help_chrome_fails(self):
        self.assertFalse(dm.evidence_matches_commitment("help: opencode usage", {"done_when": ["git diff"]}))

    def test_confirm_chat_fails(self):
        blob = (
            "Would you like me to proceed with creating this task now? "
            "Please confirm. If you need to make any additional changes, let me know."
        )
        self.assertFalse(
            dm.evidence_matches_commitment(
                blob, {"done_when": ["git diff or new/changed file under repo cited"]}
            )
        )

    def test_wrote_log_chrome_fails(self):
        self.assertFalse(
            dm.evidence_matches_commitment(
                "opencode run wrote log rc=0",
                {"done_when": ["non-empty evidence path in result"]},
            )
        )

    def test_real_path_prove_still_passes(self):
        blob = (
            "Mac T1 WG prove PASS: mac_addr=10.88.0.2 ping_10.88.0.1=True "
            "wrote desk-meters/wg-t1.json prove=status/t1-wg-mac-prove.txt sha=fca2231 rc=0"
        )
        self.assertTrue(
            dm.evidence_matches_commitment(
                blob, {"done_when": ["non-empty evidence path in result"]}
            )
        )

if __name__ == "__main__":
    unittest.main()
