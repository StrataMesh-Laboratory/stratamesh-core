"""Queue-only fog/edge must not claim act+evidence (P0 autonomy)."""
from __future__ import annotations

import unittest
from unittest import mock


class AssistantQueueNoFakeAct(unittest.TestCase):
    def test_fog_queue_is_refer_without_evidence(self):
        import desk_ops as ops

        with mock.patch.object(ops, "_http_ok", return_value=(True, "")), mock.patch.object(
            ops, "_assistant_result_file", return_value=None
        ), mock.patch.object(ops, "_write_pending_assistant_act"), mock.patch.object(
            ops, "_load"
        ) as load:
            bus = mock.Mock()
            load.return_value = bus
            out = ops.handler_fog({"id": "dt-x", "intent": "peer", "specialty": "fog"}, dry=False)
        self.assertEqual(out.get("verb"), "refer")
        self.assertFalse(out.get("evidence"))
        self.assertFalse(out.get("done"))
        self.assertIn("queued Act for fog-assistant", out.get("result") or "")

    def test_edge_queue_is_refer_without_evidence(self):
        import desk_ops as ops

        with mock.patch.object(ops, "_http_ok", return_value=(True, "")), mock.patch.object(
            ops, "_is_rate_limited", return_value=False
        ), mock.patch.object(ops, "_assistant_result_file", return_value=None), mock.patch.object(
            ops, "_write_pending_assistant_act"
        ), mock.patch.object(ops, "_load") as load:
            bus = mock.Mock()
            load.return_value = bus
            out = ops.handler_edge({"id": "dt-e", "intent": "edge", "specialty": "edge"}, dry=False)
        self.assertEqual(out.get("verb"), "refer")
        self.assertFalse(out.get("evidence"))
        self.assertFalse(out.get("done"))
        self.assertIn("queued Act for edge-assistant", out.get("result") or "")


if __name__ == "__main__":
    unittest.main()
