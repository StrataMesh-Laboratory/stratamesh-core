#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
MOD = HERE / "desk_metrics.py"


def _load():
    spec = importlib.util.spec_from_file_location("desk_metrics", MOD)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class DeskMetrics(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-metrics-"))
        os.environ["FOG_HOME"] = str(self.tmp)

    def test_record_writes_metrics_and_last_cycle(self):
        m = _load()
        path = m.record({
            "delivered": 1,
            "protocol_ok": True,
            "gh_ok": True,
            "token": "present",
            "picked": ["dt-x"],
        })
        self.assertTrue(path.is_file())
        mirror = m.last_cycle_path()
        self.assertTrue(mirror.is_file(), "last-cycle.jsonl must be written")
        row = json.loads(path.read_text(encoding="utf-8").strip().splitlines()[-1])
        row2 = json.loads(mirror.read_text(encoding="utf-8").strip().splitlines()[-1])
        self.assertEqual(row["delivered"], 1)
        self.assertEqual(row2["delivered"], 1)
        self.assertIn("ts", row)

    def test_score_recent_and_cli(self):
        m = _load()
        for i in range(3):
            m.record({
                "delivered": 1,
                "protocol_ok": True,
                "gh_ok": True,
                "token": "present",
                "idle_skip": False,
            })
        out = m.score_recent(20)
        self.assertTrue(out["ok"])
        self.assertGreaterEqual(out["score"], 70)
        self.assertEqual(out["samples"], 3)
        # score() alias
        self.assertEqual(m.score(20)["score"], out["score"])
        # CLI
        r = subprocess.run(
            [sys.executable, str(MOD), "score", "--n", "20"],
            capture_output=True, text=True, env={**os.environ, "FOG_HOME": str(self.tmp)},
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        cli = json.loads(r.stdout)
        self.assertGreaterEqual(cli["score"], 70)

    def test_score_no_samples_soft_cli(self):
        r = subprocess.run(
            [sys.executable, str(MOD), "score"],
            capture_output=True, text=True, env={**os.environ, "FOG_HOME": str(self.tmp)},
        )
        self.assertEqual(r.returncode, 0)  # soft first-boot
        body = json.loads(r.stdout)
        self.assertEqual(body.get("reason"), "no_samples")


    def test_lab_progress_snapshot(self):
        m = _load()
        prog = self.tmp / "desk-lab-progress.json"
        os.environ["DESK_LAB_PROGRESS"] = str(prog)
        st = self.tmp / "data" / "desk-collegium"
        st.mkdir(parents=True)
        (st / "state.json").write_text(
            "{\"schema\":\"desk.collegium.state.v1\",\"open_tasks\":[],\"done_tasks\":[{\"id\":\"dt-x\",\"result\":\"unittest PASS\"}]}\n",
            encoding="utf-8",
        )
        out = m.update_lab_progress(
            sample={"delivered": 1, "picked": ["dt-x"], "protocol_ok": True, "gh_ok": True},
            write=True,
        )
        self.assertTrue(out.get("written"))
        self.assertTrue(prog.is_file())
        body = json.loads(prog.read_text(encoding="utf-8"))
        self.assertEqual(body["schema"], "desk.lab.progress.v1")
        self.assertTrue(body["lab"])
        self.assertTrue(body["not_mainnet"])
        self.assertIn("challenges", body)
        self.assertIn("pass_counts", body)
        self.assertNotIn("treasury_eur", body)
        m.record({"delivered": 1, "protocol_ok": True, "picked": ["dt-y"]})
        body2 = json.loads(prog.read_text(encoding="utf-8"))
        self.assertEqual(body2["schema"], "desk.lab.progress.v1")


if __name__ == "__main__":
    unittest.main()
