#!/usr/bin/env python3
"""Unit-ish smoke for desk-mail-client (temp Maildir, no network, no secrets)."""
from __future__ import annotations

import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CLIENT = HERE / "desk-mail-client.py"


def load_mod():
    spec = importlib.util.spec_from_file_location("desk_mail_client", CLIENT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestDeskMailClient(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.md = Path(self._td.name) / "automation.desk"
        os.environ["DESK_MAILDIR"] = str(self.md)
        self.mod = load_mod()
        self.mod.ensure_maildir(self.md)

    def tearDown(self):
        self._td.cleanup()
        os.environ.pop("DESK_MAILDIR", None)

    def test_status_and_draft_roundtrip(self):
        rc = self.mod.main(["status"])
        self.assertEqual(rc, 0)
        rc = self.mod.main(
            [
                "draft",
                "compose",
                "--to",
                "automation.desk@calhegasmorais.pt",
                "--subject",
                "smoke-test",
                "--body",
                "hello desk-mail",
            ]
        )
        self.assertEqual(rc, 0)
        drafts = list((self.md / ".drafts").glob("*.eml"))
        self.assertEqual(len(drafts), 1)
        rc = self.mod.main(["draft", "list"])
        self.assertEqual(rc, 0)
        rc = self.mod.main(
            ["draft", "edit", str(drafts[0]), "--body", "edited body"]
        )
        self.assertEqual(rc, 0)
        text = drafts[0].read_text(encoding="utf-8")
        self.assertIn("edited body", text)
        rc = self.mod.main(["send", str(drafts[0])])
        self.assertEqual(rc, 0)
        sent = list((self.md / "sent").glob("*"))
        self.assertGreaterEqual(len(sent), 1)
        rc = self.mod.main(["list", "--limit", "5"])
        self.assertEqual(rc, 0)
        rc = self.mod.main(["search", "edited"])
        self.assertEqual(rc, 0)

    def test_ensure_maildir_layout(self):
        for sub in ("cur", "new", "tmp", ".drafts", "sent"):
            self.assertTrue((self.md / sub).is_dir())


if __name__ == "__main__":
    unittest.main(verbosity=2)
