"""CID-only store tests — put/get 200-semantics, miss empty. No NFT mint."""
from __future__ import annotations

import os
import tempfile
import unittest

from cid_store import get_cid, put_cid
from nft import ObjectRegistry, layers_payload, StrataReservedError


class TestCidStore(unittest.TestCase):
    def setUp(self):
        fd, self.db = tempfile.mkstemp(suffix="-cid.db")
        os.close(fd)
        os.environ["FOG_SQLITE_PATH"] = self.db

    def tearDown(self):
        try:
            os.unlink(self.db)
        except OSError:
            pass

    def test_put_then_get(self):
        rec = put_cid("bafyc1put01", {"bytes": "hello"}, db_path=self.db)
        self.assertTrue(rec["ok"])
        self.assertEqual(rec["cid"], "bafyc1put01")
        got = get_cid("bafyc1put01", db_path=self.db)
        self.assertIsNotNone(got)
        self.assertEqual(got["cid"], "bafyc1put01")
        self.assertEqual(got["payload"]["bytes"], "hello")

    def test_miss_is_none(self):
        self.assertIsNone(get_cid("bafyunknownc1notfound000000000000000000000000000000", db_path=self.db))

    def test_persist_reload(self):
        put_cid("bafyc1reload", {"k": 1}, db_path=self.db)
        got = get_cid("bafyc1reload", db_path=self.db)
        self.assertEqual(got["payload"]["k"], 1)

    def test_compose_cid_only_no_nft(self):
        r = ObjectRegistry(db_path=self.db)
        o = r.compose(
            owner="FOG-NODE-PT-CM-001",
            parts={"mesh": "c1-bytes"},
            cid_only=True,
            mint=False,
            title="c1-cid-only",
        )
        self.assertTrue(o.manifest_cid)
        self.assertFalse(o.object_id)
        layers = layers_payload(o)
        self.assertIsNone(layers["nft"]["id"])
        self.assertEqual(layers["strata"]["strata_units"], 0)
        self.assertEqual(len(r.list()), 0)
        self.assertIsNotNone(r.get_cid(o.manifest_cid))
        r.close()


if __name__ == "__main__":
    unittest.main()
