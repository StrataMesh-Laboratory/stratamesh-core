"""Digital-object ledger tests — tmp sqlite, no Workers, no STRATA mint."""
from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest

from nft import ObjectRegistry, StrataReservedError, object_id_for
from ipfs_client import IPFSClient


class TestObjectRegistry(unittest.TestCase):
    def setUp(self):
        fd, self.db = tempfile.mkstemp(suffix="-objects.db")
        os.close(fd)
        os.environ["FOG_SQLITE_PATH"] = self.db

    def tearDown(self):
        try:
            os.unlink(self.db)
        except OSError:
            pass

    def test_compose_persist_reload(self):
        r = ObjectRegistry(db_path=self.db)
        o = r.compose(
            owner="FOG-NODE-PT-CM-001",
            manifest_cid="bafytestpersist01",
            parts={"mesh": "hello"},
            kind="ugc",
            title="persist-me",
            renderer=None,
        )
        self.assertTrue(o.object_id.startswith("obj_"))
        self.assertEqual(o.object_id, object_id_for("bafytestpersist01", "FOG-NODE-PT-CM-001"))
        self.assertEqual(len(o.object_id), 4 + 16)
        r.close()
        r2 = ObjectRegistry(db_path=self.db)
        got = r2.get(o.object_id)
        self.assertIsNotNone(got)
        self.assertEqual(got.manifest_cid, "bafytestpersist01")
        self.assertEqual(got.title, "persist-me")
        listed = r2.list()
        self.assertEqual(len(listed), 1)
        r2.close()

    def test_by_cid_and_owner(self):
        r = ObjectRegistry(db_path=self.db)
        o = r.compose(
            owner="EDGE-GROK-CMN-001",
            manifest_cid="bafycidowner01",
            parts={"a": 1},
            kind="dataset",
            title="cid-hit",
        )
        hits = r.by_cid("bafycidowner01")
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].object_id, o.object_id)
        owned = r.by_owner("EDGE-GROK-CMN-001")
        self.assertEqual(len(owned), 1)
        r.close()

    def test_same_cid_owner_is_fetch_not_remint(self):
        r = ObjectRegistry(db_path=self.db)
        a = r.compose(owner="FOG-NODE-PT-CM-001", manifest_cid="bafysame01", parts={"x": 1})
        b = r.compose(owner="FOG-NODE-PT-CM-001", manifest_cid="bafysame01", parts={"x": 1})
        self.assertEqual(a.object_id, b.object_id)
        self.assertEqual(len(r.list()), 1)
        r.close()

    def test_cid_change_new_object_id(self):
        r = ObjectRegistry(db_path=self.db)
        a = r.compose(owner="FOG-NODE-PT-CM-001", manifest_cid="bafyold01", parts={"x": 1})
        b = r.compose(owner="FOG-NODE-PT-CM-001", manifest_cid="bafynew02", parts={"x": 2})
        self.assertNotEqual(a.object_id, b.object_id)
        self.assertEqual(len(r.list()), 2)
        r.close()

    def test_strata_units_stays_zero(self):
        r = ObjectRegistry(db_path=self.db)
        o = r.compose(owner="FOG-NODE-PT-CM-001", manifest_cid="bafystrata0", parts={"k": "v"})
        self.assertEqual(o.strata_units, 0)
        with self.assertRaises(StrataReservedError):
            r.compose(
                owner="FOG-NODE-PT-CM-001",
                manifest_cid="bafystrata1",
                parts={"k": "v"},
                strata_units=1.0,
            )
        r.close()

    def test_atelier_not_required_renderer_none(self):
        r = ObjectRegistry(db_path=self.db)
        o = r.compose(
            owner="FOG-NODE-PT-CM-001",
            manifest_cid="bafynorender",
            parts={"mesh": "ok"},
            kind="ugc",
            renderer="none",
        )
        self.assertEqual(o.renderer, "none")
        self.assertNotEqual(o.kind, "atelier")
        r.close()

    def test_transfer_writes_dag_tx(self):
        r = ObjectRegistry(db_path=self.db)
        o = r.compose(owner="FOG-NODE-PT-CM-001", manifest_cid="bafyxf01", parts={"p": 1})
        self.assertTrue(o.dag_tx)
        moved = r.transfer(o.object_id, "EDGE-GROK-CMN-001")
        self.assertEqual(moved.owner, "EDGE-GROK-CMN-001")
        self.assertTrue(moved.dag_tx)
        r.close()

    def test_ipfs_pins_persist(self):
        c = IPFSClient(mode="stub", db_path=self.db)
        rec = c.request_pin("bafypinlab01")
        self.assertEqual(rec.status, "pinned")
        conn = sqlite3.connect(self.db)
        row = conn.execute("SELECT status, mode FROM ipfs_pins WHERE cid=?", ("bafypinlab01",)).fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "pinned")
        c2 = IPFSClient(mode="stub", db_path=self.db)
        st = c2.status("bafypinlab01")
        self.assertIsNotNone(st)
        self.assertEqual(st.status, "pinned")


if __name__ == "__main__":
    unittest.main()
