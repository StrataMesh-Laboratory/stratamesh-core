#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

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
        self.td = tempfile.TemporaryDirectory()
        roster = {
            "schema": "desk.apps.v1",
            "workspace": "FOG-CMN-DESK",
            "browser": {
                "preferred": ["Safari"],
                "allowlist_urls": [
                    {"id": "fog-health", "url": "http://127.0.0.1:8787/health", "why": "test"},
                ],
            },
            "apps": [
                {"id": "terminal", "open": ["open", "-a", "Terminal"], "why": "shell"},
            ],
        }
        p = Path(self.td.name) / "desk-apps.json"
        p.write_text(json.dumps(roster))
        os.environ["DESK_APPS_JSON"] = str(p)

    def tearDown(self):
        os.environ.pop("DESK_APPS_JSON", None)
        self.td.cleanup()

    def test_status(self):
        self.assertEqual(self.m.main(["status"]), 0)

    def test_dry_run_browser(self):
        self.assertEqual(self.m.main(["--dry-run", "browser", "fog-health"]), 0)

    def test_dry_run_app(self):
        self.assertEqual(self.m.main(["--dry-run", "app", "terminal"]), 0)

    def test_reject_bad_url(self):
        with self.assertRaises(SystemExit):
            self.m.main(["url", "https://evil.example/phish"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
