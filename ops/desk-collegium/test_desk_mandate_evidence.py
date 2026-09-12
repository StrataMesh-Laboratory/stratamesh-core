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

if __name__ == "__main__":
    unittest.main()
