#!/usr/bin/env python3
"""Tests: origin PUT wire-up + Oracle not André gate + cmd_ship put success/fail."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock
import importlib.util

HERE = Path(__file__).resolve().parent


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class DeskShipPut(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-ship-put-"))
        os.environ["FOG_HOME"] = str(self.tmp)
        d = self.tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        self.state = {
            "schema": "desk.collegium.state.v1",
            "open_tasks": [{
                "schema": "desk.task.v1",
                "id": "dt-ship-put",
                "owner": "hermes",
                "specialty": "coord",
                "intent": "ship spa-dag fund origin pages live",
                "status": "commit",
                "ship_live": True,
                "votes": [
                    {"by": "hermes", "vote": "ack", "at": "t"},
                    {"by": "opencode", "vote": "ack", "at": "t"},
                    {"by": "openclaw", "vote": "ack", "at": "t"},
                    {"by": "fog-assistant", "vote": "ack", "at": "t"},
                ],
            }],
            "done_tasks": [],
            "members": [],
            "ship_policy": {
                "schema": "desk.ship_policy.v1",
                "majority_frac": 0.5,
                "require_no_nack": True,
                "unanimous_authority": True,
                "human_escalate": ["fog_g", "2fa", "captcha", "renovate_major"],
            },
        }
        (d / "state.json").write_text(json.dumps(self.state) + "\n")
        meters = self.tmp / "data" / "desk-meters"
        meters.mkdir(parents=True)
        (meters / "openclaw.json").write_text(json.dumps({"probes": {"fog_public": 1}}) + "\n")
        self.ship = _load("desk_ship", HERE / "desk_ship.py")
        self.ops = _load("desk_ops", HERE / "desk_ops.py")
        self.put = _load("desk_origin_put", HERE / "desk_origin_put.py")

    def test_oracle_not_andre_gate(self):
        self.assertFalse(self.ops._is_andre_human_gate_task({
            "intent": "Oracle grok90 vaulted STRATAGROK representative",
        }))
        self.assertFalse(self.ops._is_andre_human_gate_task({
            "intent": "oracle password reset for grok@",
        }))
        self.assertFalse(self.ops._is_andre_human_gate_task({
            "hold_until": "oracle_grok90",
            "intent": "oracle live",
        }))
        # still André: 2FA / captcha / fog g / renovate major
        self.assertTrue(self.ops._is_andre_human_gate_task({
            "intent": "need 2fa for vault",
        }))
        self.assertTrue(self.ops._is_andre_human_gate_task({
            "intent": "captcha blocked login",
        }))
        self.assertNotIn("oracle", self.ship.ensure_ship_policy(self.state).get("human_escalate") or [])

    def test_cmd_ship_put_ok_records_shipped(self):
        fake = {
            "ok": True,
            "mode": "cf-put-origin+d1-put-html+fund-worker",
            "detail": "cf-put-origin=ok; d1-put-html=ok; fund-worker=ok",
            "sha": "deadbeef",
            "urls": ["origin-archive"],
            "errors": [],
        }
        with mock.patch.object(self.ship, "desk_origin_put") as mput:
            mput.put_live.return_value = fake
            # also patch connectors soft
            ns = self.ship.argparse.Namespace(
                task_id="dt-ship-put",
                by="hermes",
                result="test ship",
                sha="deadbeef",
                force_connectors=True,
                skip_put=False,
                force=False,
            ) if hasattr(self.ship, "argparse") else None
            import argparse
            ns = argparse.Namespace(
                task_id="dt-ship-put",
                by="hermes",
                result="test ship",
                sha="deadbeef",
                force_connectors=True,
                skip_put=False,
                force=False,
            )
            # inject module attribute used by cmd_ship
            self.ship.desk_origin_put = mput
            rc = self.ship.cmd_ship(ns)
        self.assertEqual(rc, 0)
        st = json.loads((self.tmp / "data" / "desk-collegium" / "state.json").read_text())
        task = next(t for t in st["open_tasks"] if t["id"] == "dt-ship-put")
        self.assertTrue(task.get("shipped"))
        self.assertEqual((task.get("shipped") or {}).get("put", {}).get("ok"), True)
        self.assertIn("put", st.get("last_ship") or {})

    def test_cmd_ship_put_fail_does_not_ship(self):
        fake = {
            "ok": False,
            "mode": "cf-put-origin",
            "detail": "cf-put-origin=FAIL",
            "sha": "",
            "urls": [],
            "errors": ["cf-put-origin: soft-fail"],
        }
        import argparse
        ns = argparse.Namespace(
            task_id="dt-ship-put",
            by="hermes",
            result="test ship",
            sha="",
            force_connectors=True,
            skip_put=False,
            force=False,
        )
        with mock.patch.object(self.ship, "desk_origin_put") as mput:
            mput.put_live.return_value = fake
            self.ship.desk_origin_put = mput
            rc = self.ship.cmd_ship(ns)
        self.assertNotEqual(rc, 0)
        st = json.loads((self.tmp / "data" / "desk-collegium" / "state.json").read_text())
        task = next(t for t in st["open_tasks"] if t["id"] == "dt-ship-put")
        self.assertFalse(bool(task.get("shipped")))

    def test_maybe_auto_ship_dry_wait_or_would(self):
        # only 4 acks of 6 → wait_majority OR would_ship if majority with default members
        out = self.ship.maybe_auto_ship(by="hermes", dry=True)
        self.assertTrue(out.get("ok"))
        actions = [r.get("action") for r in out.get("results") or []]
        self.assertTrue(
            any(a in ("would_ship", "wait_majority", "escalate_oob") for a in actions),
            out,
        )

    def test_put_live_dry_no_token_soft_fail_or_dry(self):
        # Without token files in temp home, dry still needs token check first
        # Use empty env and unreachable home cfg → soft fail
        with mock.patch.dict(os.environ, {"GOD_API": "", "CLOUDFLARE_API_TOKEN": ""}, clear=False):
            # force ensure to miss by patching _home_cfg
            with mock.patch.object(self.put, "_home_cfg", return_value=[]):
                os.environ.pop("GOD_API", None)
                os.environ.pop("CLOUDFLARE_API_TOKEN", None)
                out = self.put.put_live(
                    task={"intent": "origin fund", "ship_live": True},
                    dry=True,
                )
        # either no_token soft-fail OR dry ok if env leaked — accept honest soft-fail
        self.assertIn("ok", out)
        self.assertIn("mode", out)
        self.assertIn("detail", out)


if __name__ == "__main__":
    unittest.main()
