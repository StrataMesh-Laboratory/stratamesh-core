#!/usr/bin/env python3
"""Smoke for desk-open allowlist (no GUI required for dry-run)."""
from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
MOD = HERE / "desk-open.py"


def load():
    spec = importlib.util.spec_from_file_location("desk_open", MOD)
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class TestDeskOpen(unittest.TestCase):
    def setUp(self):
        self.m = load()

    def test_status(self):
        self.assertEqual(self.m.main(["status"]), 0)

    def test_url_allowlist(self):
        self.assertTrue(self.m.url_allowed("http://127.0.0.1:8787/health"))
        self.assertFalse(self.m.url_allowed("https://evil.example/"))

    def test_dry_run_open(self):
        rc = self.m.main(["--dry-run", "open", "fog-health"])
        self.assertEqual(rc, 0)

    def test_reject_bad_url(self):
        with self.assertRaises(SystemExit):
            self.m.main(["url", "https://evil.example/phish"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
