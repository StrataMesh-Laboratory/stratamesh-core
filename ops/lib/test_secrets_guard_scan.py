"""Fixtures for secrets-guard LIVE boundary (no real secrets; no contiguous live-shaped literals)."""
from __future__ import annotations

import unittest

from secrets_guard_scan import find_live_hits


class TestSecretsGuardLive(unittest.TestCase):
    def test_desk_mail_prove_path_not_hit(self):
        diff = (
            "diff --git a/status/desk-mail-client-prove-20260912.txt "
            "b/status/desk-mail-client-prove-20260912.txt\n"
            "+++ b/status/desk-mail-client-prove-20260912.txt\n"
            "+desk-mail-client prove\n"
        )
        self.assertEqual(find_live_hits(diff), [])

    def test_desk_access_prove_path_not_hit(self):
        diff = (
            "+++ b/status/fog-cmn-desk-access-prove-20260912.txt\n"
            "+fog-cmn-desk access prove\n"
        )
        self.assertEqual(find_live_hits(diff), [])

    def test_live_shaped_sk_still_hits(self):
        # build at runtime so the source file never contains a contiguous live-shaped token
        blob = "Authorization: Bearer " + "sk-" + "abc123def456ghi7890xyz" + "\n"
        hits = find_live_hits(blob)
        self.assertTrue(hits, hits)
        self.assertTrue(any(h.startswith("sk-") for h in hits))

    def test_live_shaped_ghp_still_hits(self):
        blob = "token=" + "ghp_" + "A1b2c3d4e5f6g7h8i9j0k1lm" + "\n"
        hits = find_live_hits(blob)
        self.assertTrue(hits)
        self.assertTrue(any(h.startswith("ghp_") for h in hits))


if __name__ == "__main__":
    unittest.main()
