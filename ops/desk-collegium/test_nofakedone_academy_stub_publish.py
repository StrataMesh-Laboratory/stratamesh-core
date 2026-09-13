#!/usr/bin/env python3
"""NO-FAKE-DONE: academy publish/PASS refuses scored_by_stub drafts."""
from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent


def _load():
    spec = importlib.util.spec_from_file_location("academy_exams", HERE / "academy_exams.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class TestAcademyStubPublishHold(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="academy-stub-hold-"))
        self.fog = self.tmp / "fog"
        self.fog.mkdir()
        os.environ["FOG_HOME"] = str(self.fog)
        self.mod = _load()
        self.scores_root = self.tmp / "academy_scores"
        self.scores_root.mkdir()
        self.mod.SCORES_ROOT = self.scores_root
        self.mod.FOG = self.fog
        self.mod.REPO = self.tmp

    def _stub_scores(self):
        exam = {
            "date": "2026-09-13",
            "students": [
                {
                    "acb_id": "ACB-X",
                    "sca_id": "SCA-X",
                    "name": "Test",
                    "role": "orchestrator",
                    "formation_id": "ORCH-C-03",
                    "mode": "corrective",
                    "drills": [{"prompt": "x"}],
                    "protocol_metrics": ["fail_closed", "no_workers_dev"],
                }
            ],
        }
        return self.mod.score_stubs(exam, {"students": exam["students"]}), exam

    def test_stub_markers_detect_scored_by_stub(self):
        scores, _ = self._stub_scores()
        self.assertTrue(scores.get("scored_by_stub") is True)
        hits = self.mod.stub_markers(scores)
        self.assertTrue(any("scored_by_stub=true" in h for h in hits))
        ok, why = self.mod.scores_publishable(scores)
        self.assertFalse(ok)
        self.assertIn("HOLD", why)

    def test_teacher_fill_clears_stub_and_is_publishable(self):
        scores, exam = self._stub_scores()
        filled = self.mod.fill_teacher_scores(scores, exam)
        self.assertFalse(filled.get("scored_by_stub"))
        ok, why = self.mod.scores_publishable(filled)
        self.assertTrue(ok, why)
        self.assertEqual(why, "publishable")

    def test_maybe_publish_grades_holds_on_stub(self):
        scores, _ = self._stub_scores()
        # even if live git scores are teacher_scored/false, explicit stub must HOLD
        out = self.mod.maybe_publish_grades(dry=True, scores=scores)
        self.assertFalse(out.get("ok"))
        self.assertTrue(out.get("hold"))
        self.assertEqual(out.get("decision"), "HOLD")
        self.assertFalse(out.get("publishable"))
        self.assertIn("stub", (out.get("gate") or "").lower())

    def test_maybe_publish_grades_allows_teacher_scored(self):
        scores, exam = self._stub_scores()
        filled = self.mod.fill_teacher_scores(scores, exam)
        # dry + no build side effects: gate must pass before soft steps
        with mock.patch.object(self.mod, "REPO", self.tmp):
            out = self.mod.maybe_publish_grades(dry=True, scores=filled)
        self.assertTrue(out.get("publishable"))
        self.assertFalse(out.get("hold", False))
        self.assertNotEqual(out.get("decision"), "HOLD")

    def test_write_day_meter_not_ok_for_stub(self):
        scores, exam = self._stub_scores()
        roster = {"students": exam["students"], "teachers": []}
        d = date(2026, 9, 13)
        (self.tmp / "src" / "academy").mkdir(parents=True, exist_ok=True)
        out = self.mod.write_day(d, roster, exam, scores, dry=False)
        self.assertTrue(out["ok"])  # draft write OK
        self.assertFalse(out.get("publishable"))
        self.assertTrue(out.get("scored_by_stub"))
        meter_p = self.fog / "data" / "desk-meters" / "academy-daily-exam.json"
        # meter_path uses FOG
        mp = self.mod.meter_path()
        self.assertTrue(mp.is_file())
        meter = json.loads(mp.read_text(encoding="utf-8"))
        self.assertFalse(meter.get("ok"), "stub draft must not stamp meter ok/PASS")

    def test_equiv_student_status_stub_blocks_even_if_flag_false(self):
        scores = {
            "scored_by_stub": False,
            "students": [{"acb_id": "ACB-X", "status": "draft_scored_stub", "objective_metrics": {}}],
        }
        ok, why = self.mod.scores_publishable(scores)
        self.assertFalse(ok)
        self.assertIn("draft_scored_stub", why)


if __name__ == "__main__":
    unittest.main()
