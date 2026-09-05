"""Exclusive-off fog_db unit tests — no live MariaDB required.

Run from repo root:
  PYTHONPATH=src python3 -m unittest src.test_fog_db -v
or:
  cd src && python3 -m unittest test_fog_db -v
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

# Allow `python3 -m unittest test_fog_db` from src/ or repo root.
_SRC = Path(__file__).resolve().parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import fog_db  # noqa: E402


class TestFogDbExclusiveOff(unittest.TestCase):
    def setUp(self) -> None:
        self._old_url = os.environ.pop("FOG_MYSQL_URL", None)
        self._old_pw = os.environ.pop("STAFF_GROK_PASSWORD", None)
        self._tmpdir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self._tmpdir.name) / "fog-dsn-test.db")

    def tearDown(self) -> None:
        if self._old_url is None:
            os.environ.pop("FOG_MYSQL_URL", None)
        else:
            os.environ["FOG_MYSQL_URL"] = self._old_url
        if self._old_pw is None:
            os.environ.pop("STAFF_GROK_PASSWORD", None)
        else:
            os.environ["STAFF_GROK_PASSWORD"] = self._old_pw
        self._tmpdir.cleanup()

    def test_health_payload_ok_without_import_side_effects(self) -> None:
        self.assertEqual(fog_db.health_payload(), {"ok": True})

    def test_unset_url_uses_sqlite(self) -> None:
        os.environ.pop("FOG_MYSQL_URL", None)
        store = fog_db.open_store(self.db_path)
        try:
            self.assertEqual(store.backend, "sqlite")
            self.assertFalse(store.mysql_fallback)
            self.assertEqual(fog_db.health_payload(), {"ok": True})
            status = store.storage_status()
            self.assertEqual(status.get("backend"), "sqlite")
            # must not leak password keys
            blob = str(status).lower()
            self.assertNotIn("password", blob)
        finally:
            store.close()

    def test_bad_dsn_falls_back_sqlite(self) -> None:
        # Closed port / unreachable — must not raise; SQLite fallback.
        os.environ["FOG_MYSQL_URL"] = "mysql://grok@127.0.0.1:1/fog_cmn"
        store = fog_db.open_store(self.db_path, mysql_timeout=0.5)
        try:
            self.assertEqual(store.backend, "sqlite")
            self.assertTrue(store.mysql_fallback)
            self.assertEqual(fog_db.health_payload(), {"ok": True})
            redacted = store.dsn_redacted or ""
            self.assertNotIn("password", redacted.lower())
        finally:
            store.close()

    def test_redact_dsn_strips_password(self) -> None:
        raw = "mysql://grok:s3cret@127.0.0.1:3306/fog_cmn"
        out = fog_db.redact_dsn(raw)
        self.assertNotIn("s3cret", out)
        self.assertIn("mysql://", out)


if __name__ == "__main__":
    unittest.main()
