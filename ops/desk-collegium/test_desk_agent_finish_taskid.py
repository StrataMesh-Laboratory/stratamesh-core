"""desk_agent_finish: --task-id + status prove markers."""
from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _load():
    spec = importlib.util.spec_from_file_location("desk_agent_finish", HERE / "desk_agent_finish.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class TestDeskAgentFinishTaskId(unittest.TestCase):
    def test_pick_task_prefers_commit_and_task_id(self):
        m = _load()
        st = {
            "open_tasks": [
                {"id": "dt-propose", "owner": "hermes@fog", "status": "propose"},
                {"id": "dt-commit", "owner": "hermes@fog", "status": "commit"},
            ]
        }
        self.assertEqual(m._pick_task(st, "hermes")["id"], "dt-commit")
        self.assertEqual(m._pick_task(st, "hermes", task_id="dt-propose")["id"], "dt-propose")

    def test_status_prove_markers_count_as_evidence(self):
        m = _load()
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "status" / "t1-wg-mac-residual-prove.txt"
            p.parent.mkdir(parents=True)
            p.write_text(
                "t1_wg_mac_residual_prove host=MBPA\n"
                "utun9: 10.88.0.2\n"
                "PING 10.88.0.1\n2 packets transmitted, 2 packets received\n"
                "asymmetric=mac_ping_box_ok_box_tcp_mac_fail\n"
                "iphone_faked=false\n"
                "local8787=200\n"
                "git_head=b7e6692\n"
                "box_to_mac_tcp22=TIMEOUT\n",
                encoding="utf-8",
            )
            self.assertTrue(m._evidence_ok(str(p)))


if __name__ == "__main__":
    unittest.main()
