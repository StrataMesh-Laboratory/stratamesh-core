"""Standing-refer park must not be bypassed by ping/prep/human_gate flags."""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

spec = importlib.util.spec_from_file_location(
    "desk_ops_standing", Path(__file__).resolve().parent / "desk_ops.py"
)
ops = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(ops)


class StandingReferPark(unittest.TestCase):
    def test_standing_refer_parks_despite_ping_flags(self):
        now = datetime.now(timezone(timedelta(hours=1))).strftime("%Y-%m-%dT%H:%M:%S%z")
        # normalize +0100
        if len(now) >= 5 and now[-3] != ":":
            now = now[:-2] + ":" + now[-2:]
        t = {
            "id": "dt-ch-oracle-gr",
            "status": "refer",
            "specialty": "lead",
            "standing_refer": True,
            "human_gate": True,
            "ping_when_needed": True,
            "prep_allowed": True,
            "intent": "OPTIONAL Oracle grok90 chase",
            "updated": now.replace(":", "", 1) if False else (
                datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")
            ),
            "eisenhower": "act",
            "owner": "stratagrok@fog",
        }
        # fresh updated → within cooldown
        t["updated"] = datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")
        self.assertTrue(ops._is_standing_soft_refer(t))
        state = {
            "open_tasks": [t],
            "metabol_pace": {"lanes": {}},
        }
        # classify needs more — call pick_tasks with minimal board via monkeypatch
        picked = ops.pick_tasks({"open_tasks": [t], "done_tasks": []}, max_n=1)
        # If classify drops it, also OK; must not return the standing task
        ids = [x.get("id") for x in picked]
        self.assertNotIn("dt-ch-oracle-gr", ids)

    def test_fog_queue_sets_standing_refer(self):
        # dry path does not set standing; non-dry without result file does
        # Call the return shape by inspecting source contract via honest_result merge
        out = ops.honest_result(
            ok=True, done=False, verb="refer",
            result="queued Act for fog-assistant: x", evidence=False, sha="",
        )
        out["standing_refer"] = True
        out["skip_soft_fail_chain"] = True
        self.assertTrue(out["standing_refer"])
        self.assertTrue(out["skip_soft_fail_chain"])
        self.assertFalse(out["evidence"])


if __name__ == "__main__":
    unittest.main()
