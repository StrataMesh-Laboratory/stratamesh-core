#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location("desk_metabol", Path(__file__).parent / "desk_metabol.py")
_MOD = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(_MOD)


class DeskMetabol(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-met-"))
        os.environ["FOG_HOME"] = str(self.tmp)
        _MOD.FOG = self.tmp
        (self.tmp / "data/desk-collegium").mkdir(parents=True)
        (self.tmp / "data/desk-meters").mkdir(parents=True)
        state = {
            "schema": "desk.collegium.state.v1",
            "members": [
                {"id": "hermes@fog", "lane": "lane-hermes", "pace": "ALLOW", "specialty": "coord"},
                {"id": "openclaw@fog", "lane": "lane-openclaw", "pace": "ALLOW", "specialty": "claw"},
            ],
            "open_tasks": [
                {"id": "dt-test1", "owner": "opencode@fog", "status": "propose", "intent": "needle", "specialty": "code"},
            ],
        }
        (self.tmp / "data/desk-collegium/state.json").write_text(json.dumps(state))
        (self.tmp / "data/desk-meters/openclaw.json").write_text(
            json.dumps({"tokens_used": 2100, "tokens_limit": 33000, "model": "llava:latest"})
        )

    def test_tick_sets_lanes_and_mirrors_feed(self):
        out = _MOD.tick()
        self.assertTrue(out["ok"])
        self.assertEqual(out["lanes"]["lane-openclaw"], "ALLOW")
        self.assertGreaterEqual(out["mirrored"], 1)
        feed = (self.tmp / "data/desk-feed.jsonl").read_text()
        self.assertIn("dt-test1", feed)
        state = json.loads((self.tmp / "data/desk-collegium/state.json").read_text())
        self.assertIn("lanes", state)
        self.assertEqual(state["lanes"]["lane-openclaw"]["renewal"], "session_or_model_reload")

    def test_openclaw_hold_at_80pct(self):
        (self.tmp / "data/desk-meters/openclaw.json").write_text(
            json.dumps({"tokens_used": 28000, "tokens_limit": 33000})
        )
        out = _MOD.tick()
        self.assertEqual(out["lanes"]["lane-openclaw"], "HOLD")

    def test_platforms_typology_present(self):
        out = _MOD.tick()
        self.assertTrue(out.get("ok"))
        plats = out.get("platforms") or {}
        for name in (
            "cf-workers", "cf-kv", "cf-pages-html", "local-mw", "fog-kernel",
            "desk-agents", "academy-exams", "tailscale", "deno-deploy-free",
            "fund-origin-put",
        ):
            self.assertIn(name, plats, name)
            self.assertIn(plats[name], ("ALLOW", "HOLD", "STASIS"), name)
        self.assertEqual(plats["cf-pages-html"], "ALLOW")
        self.assertEqual(plats["deno-deploy-free"], "ALLOW")
        state = json.loads((self.tmp / "data/desk-collegium/state.json").read_text())
        self.assertTrue(state.get("metabol_pace"))
        self.assertIn("platforms", state)
        self.assertFalse(state["platforms"]["academy-exams"].get("bot_required", True))

    def test_cf_kv_hold_at_80pct(self):
        (self.tmp / "data/desk-meters/cf-kv.json").write_text(
            json.dumps({"writes_used": 850, "daily_limit": 1000})
        )
        out = _MOD.tick()
        self.assertEqual(out["platforms"]["cf-kv"], "HOLD")

    def test_platform_allows_auth_never_503(self):
        (self.tmp / "data/desk-meters/cf.json").write_text(
            json.dumps({"remaining": 1000, "daily_limit": 100_000, "hour_spent": 999999})
        )
        lanes = _MOD.compute_lanes({"members": []})
        plats = _MOD.compute_platforms(lanes)
        ok, pace, meta = _MOD.platform_allows(plats, "cf-workers", action="auth")
        self.assertTrue(ok)
        self.assertEqual(meta.get("reason"), "auth_never_503")

    def test_fund_origin_gated_on_hold(self):
        (self.tmp / "data/desk-meters/cf.json").write_text(
            json.dumps({"remaining": 10000, "daily_limit": 100_000})
        )
        lanes = _MOD.compute_lanes({"members": []})
        plats = _MOD.compute_platforms(lanes)
        self.assertEqual(plats["cf-workers"]["pace"], "HOLD")
        ok_f, pace_f, _ = _MOD.platform_allows(plats, "fund-origin-put", action="fund")
        self.assertFalse(ok_f)
        self.assertEqual(pace_f, "HOLD")
        ok_p, pace_p, _ = _MOD.platform_allows(plats, "fund-origin-put", action="pages")
        self.assertTrue(ok_p)
        self.assertEqual(pace_p, "ALLOW")

    def test_deno_deploy_fallback_only(self):
        plats = _MOD.compute_platforms(_MOD.compute_lanes({"members": []}))
        ok, pace, meta = _MOD.platform_allows(plats, "deno-deploy-free", action="primary")
        self.assertFalse(ok)
        ok2, _, meta2 = _MOD.platform_allows(plats, "deno-deploy-free", action="fallback")
        self.assertTrue(ok2)
        self.assertEqual(meta2.get("reason"), "fallback_only")



if __name__ == "__main__":
    unittest.main()
