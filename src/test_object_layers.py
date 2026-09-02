"""Four-layer digital object catalog — in-process ObjectRegistry, tmp sqlite.

CID = bytes, DAG = history, NFT = network object, STRATA = economic (reserved).
Atelier is a renderer only. No Workers. No STRATA mint.
"""
from __future__ import annotations

import os
import tempfile
import unittest

from nft import ObjectRegistry, StrataReservedError, layers_payload


class TestObjectLayers(unittest.TestCase):
    def setUp(self):
        fd, self.db = tempfile.mkstemp(suffix="-layers.db")
        os.close(fd)
        os.environ["FOG_SQLITE_PATH"] = self.db

    def tearDown(self):
        try:
            os.unlink(self.db)
        except OSError:
            pass

    def test_c3_compose_multipart_dragon(self):
        r = ObjectRegistry(db_path=self.db)
        o = r.compose(
            owner="FOG-NODE-PT-CM-001",
            parts={
                "mesh": "dragon-body-v1",
                "texture": "scale-iridescent",
                "rig": "wing-spine",
                "voice": "roar-clip",
            },
            kind="ugc",
            title="multipart-dragon",
            renderer="none",
        )
        self.assertTrue(o.manifest_cid)
        self.assertTrue(o.cid)
        self.assertTrue(o.dag_tx)
        self.assertTrue(o.object_id.startswith("obj_"))
        layers = layers_payload(o)
        self.assertEqual(layers["nft"]["id"], o.object_id)
        self.assertEqual(layers["nft"]["id"], o.object_id)
        self.assertNotEqual(layers["nft"]["id"], o.manifest_cid)
        self.assertNotEqual(o.object_id, o.cid)
        self.assertEqual(o.strata_units, 0)
        self.assertEqual(layers["strata"]["strata_units"], 0)
        self.assertEqual(o.renderer, "none")
        r.close()

    def test_c5_building_four_part_roles_one_nft(self):
        r = ObjectRegistry(db_path=self.db)
        parts = {
            "foundation": "pad-01",
            "envelope": "walls-glass",
            "systems": "hvac-grid",
            "interior": "atrium",
        }
        o = r.compose(
            owner="FOG-NODE-PT-CM-001",
            parts=parts,
            kind="building",
            title="lab-building",
            renderer="none",
        )
        self.assertEqual(len(o.parts), 4)
        self.assertEqual(set(o.parts.keys()), set(parts.keys()))
        self.assertEqual(len(r.list()), 1)
        self.assertEqual(layers_payload(o)["nft"]["id"], o.object_id)
        self.assertNotEqual(o.object_id, o.manifest_cid)
        r.close()

    def test_c6_new_bytes_new_cid_and_object_id(self):
        r = ObjectRegistry(db_path=self.db)
        a = r.compose(
            owner="FOG-NODE-PT-CM-001",
            parts={"mesh": "bytes-alpha"},
            kind="ugc",
            title="c6-a",
        )
        b = r.compose(
            owner="FOG-NODE-PT-CM-001",
            parts={"mesh": "bytes-beta"},
            kind="ugc",
            title="c6-b",
        )
        self.assertNotEqual(a.manifest_cid, b.manifest_cid)
        self.assertNotEqual(a.object_id, b.object_id)
        self.assertNotEqual(a.object_id, a.manifest_cid)
        r.close()

    def test_c1_unknown_cid_empty_not_nft(self):
        r = ObjectRegistry(db_path=self.db)
        hits = r.by_cid("bafyunknownc1notfound000000000000000000000000000000")
        self.assertEqual(hits, [])
        missing = r.get("obj_deadbeefdeadbeef")
        self.assertIsNone(missing)
        r.close()

    def test_c4_strata_units_one_refused(self):
        r = ObjectRegistry(db_path=self.db)
        with self.assertRaises(StrataReservedError):
            r.compose(
                owner="FOG-NODE-PT-CM-001",
                parts={"mesh": "x"},
                strata_units=1,
            )
        r.close()

    def test_illegal_compose_without_parts_or_cid(self):
        r = ObjectRegistry(db_path=self.db)
        with self.assertRaises(ValueError):
            r.compose(owner="FOG-NODE-PT-CM-001", parts={}, manifest_cid="")
        with self.assertRaises(ValueError):
            r.compose(owner="FOG-NODE-PT-CM-001")
        with self.assertRaises(ValueError):
            r.register(owner="FOG-NODE-PT-CM-001", parts={}, manifest_cid=None)
        self.assertEqual(len(r.list()), 0)
        r.close()


if __name__ == "__main__":
    unittest.main()
