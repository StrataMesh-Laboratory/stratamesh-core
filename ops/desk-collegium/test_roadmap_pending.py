#!/usr/bin/env python3
"""Unit tests: roadmap → telos Pending refresh (no fake PASS)."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
import importlib.util

HERE = Path(__file__).resolve().parent
OPS = HERE / "desk_ops.py"
RP = HERE / "roadmap_pending.py"
THRESH = HERE / "roadmap_thresholds.json"


def _load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class RoadmapPendingRefresh(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="rm-pending-"))
        os.environ["FOG_HOME"] = str(self.tmp)
        d = self.tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        state = {
            "schema": "desk.collegium.state.v1",
            "version": "0.3.5-lab",
            "members": [],
            "open_tasks": [],
            "done_tasks": [],
            "lanes": {
                "lane-openclaw": {"pace": "ALLOW"},
                "lane-hermes": {"pace": "ALLOW"},
                "lane-opencode": {"pace": "ALLOW"},
                "lane-bot": {"pace": "HOLD"},
                "lane-assistant": {"pace": "ALLOW"},
                "lane-cf": {"pace": "ALLOW"},
                "lane-fog-hop": {"pace": "ALLOW"},
            },
        }
        (d / "state.json").write_text(json.dumps(state, indent=2) + "\n")
        self.mod = _load(OPS, "desk_ops")
        self.rp = _load(RP, "roadmap_pending")

    def test_catalog_has_documented_milestones_no_vapour_pass(self):
        data = json.loads(THRESH.read_text(encoding="utf-8"))
        self.assertEqual(data.get("spine"), "docs/ROADMAP-VISION.md")
        ids = [t["id"] for t in data["thresholds"]]
        self.assertIn("rm-m2-twohost", ids)
        self.assertIn("rm-m3-fog-appliance", ids)
        self.assertIn("rm-m9-mature-mainnet", ids)
        self.assertTrue((data.get("telos") or "").strip(), "telos field required")
        self.assertIn("M-IX", data.get("telos"))
        for t in data["thresholds"]:
            self.assertFalse(t.get("met"), f"{t['id']} must not invent met/PASS")
            self.assertIn("ROADMAP", (t.get("source_doc") or t.get("intent") or "").upper()
                          + (t.get("intent") or "").upper()
                          + (t.get("source_doc") or "").upper())

    def test_fallback_parses_vision_when_catalog_missing(self):
        vision = HERE.parents[1] / "docs" / "ROADMAP-VISION.md"
        if not vision.is_file():
            self.skipTest("ROADMAP-VISION.md not in repo checkout")
        data = self.rp.fallback_thresholds_from_docs(vision)
        self.assertTrue(data.get("fallback"))
        ids = [t["id"] for t in data["thresholds"]]
        self.assertIn("rm-m1-lab-protocol", ids)
        self.assertIn("rm-m9-mature-mainnet", ids)
        self.assertGreaterEqual(len(data["thresholds"]), 8)

    def test_refresh_seeds_pending_idempotent_no_pass(self):
        bus = self.mod._load("desk_bus")
        first = self.mod.refresh_roadmap_pending(bus, bus.load_state(), dry=False, limit=16)
        self.assertTrue(first, "expected roadmap-derived pending seeds")
        for tid in first:
            self.assertTrue(str(tid).startswith("dt-rm-"), tid)
        state = bus.load_state()
        board = self.mod.classify(state)
        self.assertTrue(board["pending"], "Pending must be nonempty after refresh")
        sources = {t.get("source") for t in state["open_tasks"]}
        self.assertTrue(any(str(s).startswith("roadmap:") for s in sources))
        for t in state["open_tasks"]:
            if str(t.get("source") or "").startswith("roadmap:"):
                self.assertNotEqual(t.get("status"), "done")
                self.assertNotEqual((t.get("result") or "").upper(), "PASS")
        # at least one plan item stays in Pending (not all act)
        ehs = {t.get("eisenhower") for t in board["pending"]}
        self.assertIn("plan", ehs)
        second = self.mod.refresh_roadmap_pending(bus, bus.load_state(), dry=False, limit=16)
        self.assertEqual(second, [], "second refresh must not duplicate open ids")
        ids1 = sorted(t["id"] for t in state["open_tasks"])
        ids2 = sorted(t["id"] for t in bus.load_state()["open_tasks"])
        self.assertEqual(ids1, ids2)

    def test_refresh_skips_open_aliases_and_does_not_duplicate(self):
        bus = self.mod._load("desk_bus")
        state = bus.load_state()
        state["open_tasks"] = [{
            "schema": "desk.task.v1",
            "id": "dt-proj-m2-twohost",
            "owner": "stratagrok",
            "specialty": "lead",
            "intent": "M-II twohost already open",
            "status": "act",
            "source": "projected:proj-m2-twohost",
        }]
        bus.save_state(state)
        seeded = self.mod.refresh_roadmap_pending(bus, bus.load_state(), dry=False)
        self.assertNotIn("dt-rm-m2-twohost", seeded)
        ids = {t["id"] for t in bus.load_state()["open_tasks"]}
        self.assertNotIn("dt-rm-m2-twohost", ids)
        # still added other unmet
        self.assertTrue(any(i.startswith("dt-rm-") for i in seeded), seeded)

    def test_after_clearing_leftovers_pending_regenerates(self):
        bus = self.mod._load("desk_bus")
        self.mod.refresh_roadmap_pending(bus, bus.load_state(), dry=False)
        state = bus.load_state()
        # simulate leftover-only board then clear all open (starvation case)
        state["done_tasks"] = list(state.get("open_tasks") or [])
        for t in state["done_tasks"]:
            t["status"] = "done"
        state["open_tasks"] = []
        bus.save_state(state)
        # aliases of done items must not be re-seeded; next unmet should appear
        again = self.mod.refresh_roadmap_pending(bus, bus.load_state(), dry=False, limit=8)
        state2 = bus.load_state()
        board = self.mod.classify(state2)
        # either new ids added OR remaining catalog still yields pending
        pending_ids = {t["id"] for t in board["pending"]}
        self.assertTrue(
            pending_ids or again,
            "after clearing leftovers, refresh must re-fill Pending from later thresholds",
        )
        for t in board["pending"]:
            self.assertNotEqual(t.get("status"), "done")

    def test_write_todo_board_pending_section(self):
        bus = self.mod._load("desk_bus")
        self.mod.refresh_roadmap_pending(bus, bus.load_state(), dry=False)
        rep = self.mod._load("desk_reports")
        path = rep.write_todo_board(state=bus.load_state())
        text = Path(path).read_text(encoding="utf-8")
        self.assertIn("## Pending (propose)", text)
        self.assertNotIn("_none_\n\n## Escalated", text)
        self.assertIn("dt-rm-", text)
        self.assertIn("roadmap_thresholds", text.lower() + text)


if __name__ == "__main__":
    unittest.main()
