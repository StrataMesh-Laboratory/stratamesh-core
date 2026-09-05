#!/usr/bin/env python3
"""Tests for academy daily exams (Mac Fog primary, Bot-independent)."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
import importlib.util

HERE = Path(__file__).resolve().parent


def _load():
    spec = importlib.util.spec_from_file_location("academy_exams", HERE / "academy_exams.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class AcademyExams(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="academy-exams-"))
        self.fog = self.tmp / "fog"
        self.fog.mkdir()
        os.environ["FOG_HOME"] = str(self.fog)
        self.mod = _load()
        # redirect scores root into tmp by patching module
        self.scores = self.tmp / "academy_scores"
        self.scores.mkdir()
        self.mod.SCORES_ROOT = self.scores
        self.mod.FOG = self.fog

    def test_teachers_not_in_roster_students(self):
        roster = self.mod.load_roster(refresh=True)
        ids = {s.get("acb_id") for s in roster["students"]}
        self.assertIn("ACB-ORCH-CMN-001", ids)
        self.assertIn("ACB-AIOPS-devops", ids)
        teacher_ids = {t["id"] for t in roster["teachers"]}
        self.assertIn("hermes", teacher_ids)
        for tid in teacher_ids:
            self.assertNotIn(tid, ids)
        # no desk agent emails as students
        blob = json.dumps(roster["students"])
        self.assertNotIn("hermes@fog", blob)
        self.assertNotIn("grok@", blob)

    def test_draft_builds_on_prior(self):
        d0 = date(2026, 9, 4)
        d1 = date(2026, 9, 5)
        roster = self.mod.load_roster(refresh=True)
        exam0 = self.mod.draft_exam(d0, roster, None)
        scores0 = self.mod.score_stubs(exam0, roster, prior=None)
        # inject an adjustment so day1 carries it
        scores0["students"][0]["adjustments_needed"] = ["rehearse fail-closed silence"]
        scores0["students"][0]["qualitative"]["adjustments_needed"] = [
            "rehearse fail-closed silence"
        ]
        self.mod.write_day(d0, roster, exam0, scores0, dry=False)
        prior = self.mod.load_prior(d1)
        self.assertIsNotNone(prior)
        self.assertEqual(prior["date"], d0.isoformat())
        exam1 = self.mod.draft_exam(d1, roster, prior)
        self.assertTrue(exam1["cumulative"])
        self.assertEqual(exam1["prior_date"], d0.isoformat())
        self.assertTrue(any("fail-closed" in str(a) for a in exam1["prior_adjustments"]))
        scores1 = self.mod.score_stubs(exam1, roster, prior=prior)
        row = next(s for s in scores1["students"] if s["acb_id"] == scores0["students"][0]["acb_id"])
        self.assertIn("rehearse fail-closed silence", row["adjustments_needed"])

    def test_run_daily_writes_layout(self):
        d = date(2026, 9, 5)
        out = self.mod.run_daily(day=d, dry=False, force=True)
        self.assertTrue(out["ok"])
        self.assertFalse(out.get("bot_required", True))
        day = self.scores / d.isoformat()
        for name in ("exam.json", "scores.json", "teachers.json"):
            self.assertTrue((day / name).is_file(), name)
        self.assertTrue((self.scores / "latest.json").is_file())
        self.assertTrue((self.scores / "roster.json").is_file())
        latest = json.loads((self.scores / "latest.json").read_text())
        self.assertEqual(latest["date"], d.isoformat())
        # idempotent skip
        skip = self.mod.run_daily(day=d, dry=False, force=False)
        self.assertTrue(skip.get("skipped"))

    def test_due_for_run(self):
        d = date(2026, 9, 5)
        self.assertTrue(self.mod.due_for_run(d=d))
        self.mod.run_daily(day=d, force=True)
        self.assertFalse(self.mod.due_for_run(d=d))
        self.assertTrue(self.mod.due_for_run(d=d, force=True))

    def test_protocol_metrics_present(self):
        roster = self.mod.load_roster(refresh=True)
        exam = self.mod.draft_exam(date(2026, 9, 5), roster, None)
        self.assertTrue(exam["students"])
        for st in exam["students"]:
            self.assertTrue(st["protocol_metrics"])
            self.assertTrue(st["drills"])
            self.assertTrue(st["formation_id"])


if __name__ == "__main__":
    unittest.main()
