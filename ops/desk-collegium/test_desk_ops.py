#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
import importlib.util
import shutil

ROOT = Path(__file__).resolve().parents[2]
OPS = Path(__file__).resolve().parent / "desk_ops.py"
PROJ = Path(__file__).resolve().parent / "projected.json"


def _load_ops():
    spec = importlib.util.spec_from_file_location("desk_ops", OPS)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class DeskOps(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="desk-ops-"))
        os.environ["FOG_HOME"] = str(self.tmp)
        d = self.tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        state = {
            "schema": "desk.collegium.state.v1",
            "version": "0.3.5-lab",
            "members": [],
            "open_tasks": [{
                "schema": "desk.task.v1",
                "id": "dt-test-claw",
                "owner": "openclaw@fog",
                "specialty": "claw",
                "intent": "probe",
                "status": "constrain",
                "constraints": [],
                "result": "",
                "sha": "",
            }],
            "done_tasks": [],
            "lanes": {
                "lane-openclaw": {"pace": "ALLOW"},
                "lane-hermes": {"pace": "ALLOW"},
                "lane-opencode": {"pace": "ALLOW"},
                "lane-bot": {"pace": "HOLD"},
                "lane-assistant": {"pace": "ALLOW"},
            },
        }
        (d / "state.json").write_text(json.dumps(state, indent=2) + "\n")
        self.mod = _load_ops()

    def test_cycle_completes_claw(self):
        mod = self.mod
        mod._http_ok = lambda url, timeout=6.0, retries=2: (True, "200:ok")  # type: ignore
        mod._push = lambda bus: None  # type: ignore
        mod.record_taper_status = lambda dry=False: {"ok": True, "trial_ends_pt": "2026-09-16"}  # type: ignore
        ns = type("A", (), {"max": 1, "dry_run": False})()
        rc = mod.cmd_cycle(ns)
        self.assertEqual(rc, 0)
        state = json.loads((self.tmp / "data/desk-collegium/state.json").read_text())
        self.assertNotIn("dt-test-claw", {t["id"] for t in state.get("open_tasks") or []})
        self.assertIn("dt-test-claw", {t["id"] for t in state.get("done_tasks") or []})
        metrics = self.tmp / "data" / "desk-metrics.jsonl"
        last = self.tmp / "data" / "last-cycle.jsonl"
        self.assertTrue(metrics.is_file(), "desk-metrics.jsonl missing after cycle")
        self.assertTrue(last.is_file(), "last-cycle.jsonl missing after cycle")
        row = json.loads(metrics.read_text().strip().splitlines()[-1])
        self.assertGreaterEqual(int(row.get("delivered") or 0), 1)
        self.assertTrue(row.get("protocol_ok"))

    def test_ensure_projected_idempotent_and_holds(self):
        """Catalog seed uses stable ids; second ensure is no-op; Oracle/T3 stay held."""
        mod = self.mod
        bus = mod._load("desk_bus")
        # empty open tasks so catalog can seed freely
        state = bus.load_state()
        state["open_tasks"] = []
        bus.save_state(state)

        first = mod.ensure_projected_catalog(bus, bus.load_state(), dry=False)
        self.assertTrue(first, "expected at least one seed from projected catalog")
        # stable ids
        for tid in first:
            self.assertTrue(str(tid).startswith("dt-proj-"), tid)
        state1 = bus.load_state()
        ids1 = sorted(t["id"] for t in state1["open_tasks"])
        sources1 = sorted(t.get("source") or "" for t in state1["open_tasks"])

        second = mod.ensure_projected_catalog(bus, bus.load_state(), dry=False)
        self.assertEqual(second, [], "second ensure must be idempotent (no re-seed)")
        state2 = bus.load_state()
        self.assertEqual(sorted(t["id"] for t in state2["open_tasks"]), ids1)
        self.assertEqual(sorted(t.get("source") or "" for t in state2["open_tasks"]), sources1)

        # T3 + T4 + headscale remain held; Oracle is STRATAGROK act (seeded, not André park)
        board = mod.classify(bus.load_state())
        held_ids = {i["id"] for i in board["projected"] if i.get("_hold")}
        self.assertNotIn("proj-oracle-260826", held_ids)
        self.assertIn("proj-ts-taper-t3", held_ids)
        self.assertIn("proj-ts-taper-t4", held_ids)
        self.assertIn("proj-ts-headscale-spike", held_ids)

        # T1 must be seeded (Act NOW); Mac is STRATAGROK representative (not André escalate)
        open_by_src = {t.get("source"): t for t in state2["open_tasks"]}
        self.assertIn("projected:proj-ts-taper-t1", open_by_src)
        self.assertEqual(open_by_src["projected:proj-ts-taper-t1"].get("eisenhower"), "act")
        mac = open_by_src.get("projected:proj-mac-desk-operative")
        self.assertIsNotNone(mac)
        self.assertEqual(mac.get("status"), "propose")
        self.assertTrue(mac.get("resolve_as_representative") or not mac.get("andre_gate"))
        self.assertFalse(mac.get("andre_gate"))

        # Oracle seeded as open representative act (login/reset may still block — not done)
        ora = open_by_src.get("projected:proj-oracle-260826")
        self.assertIsNotNone(ora)
        self.assertNotEqual(ora.get("status"), "done")

        # T2 plan seeded as propose, not auto-picked
        t2 = open_by_src.get("projected:proj-ts-taper-t2")
        self.assertIsNotNone(t2)
        self.assertEqual(t2.get("eisenhower"), "plan")
        self.assertEqual(t2.get("status"), "propose")
        picked = mod.pick_tasks(state2, max_n=10, include_human_gates=False)
        picked_ids = {t["id"] for t in picked}
        self.assertNotIn(t2["id"], picked_ids)

    def test_false_escalate_unpark_not_andre_gate(self):
        mod = self.mod
        bus = mod._load("desk_bus")
        state = bus.load_state()
        state["open_tasks"].append({
            "schema": "desk.task.v1",
            "id": "dt-vault-false-esc",
            "owner": "stratagrok@desk",
            "specialty": "lead",
            "intent": "materialize ~/.config/stratagrok/automation.desk.imap vault present",
            "status": "escalate",
            "human_gate": True,
            "andre_gate": True,
            "escalate_to_andre": True,
            "constraints": [],
            "result": "vault missing",
            "sha": "",
        })
        state["open_tasks"].append({
            "schema": "desk.task.v1",
            "id": "dt-true-2fa",
            "owner": "lead@desk",
            "specialty": "lead",
            "intent": "André 2FA on Fog installer mail",
            "status": "escalate",
            "constraints": [],
            "result": "",
            "sha": "",
        })
        bus.save_state(state)
        self.assertFalse(mod._is_andre_human_gate_task(state["open_tasks"][-2]))
        self.assertTrue(mod._is_andre_human_gate_task(state["open_tasks"][-1]))
        moved = mod.unpark_false_escalates(bus, bus.load_state(), dry=False)
        self.assertIn("dt-vault-false-esc", moved)
        self.assertNotIn("dt-true-2fa", moved)
        by_id = {t["id"]: t for t in bus.load_state()["open_tasks"]}
        self.assertEqual(by_id["dt-vault-false-esc"]["status"], "revise")
        self.assertTrue(by_id["dt-vault-false-esc"].get("resolve_as_representative"))
        self.assertEqual(by_id["dt-true-2fa"]["status"], "escalate")

    def test_pick_actable_fallback_not_idle_when_acts_open(self):
        mod = self.mod
        bus = mod._load("desk_bus")
        state = bus.load_state()
        state["open_tasks"] = [{
            "schema": "desk.task.v1",
            "id": "dt-m1-claw-loop",
            "owner": "openclaw@fog",
            "specialty": "claw",
            "intent": "recurring hop health",
            "status": "propose",
            "eisenhower": "act",
            "constraints": [],
            "result": "",
            "sha": "",
        }]
        bus.save_state(state)
        picked = mod.pick_actable_fallback(bus.load_state(), max_n=1)
        self.assertEqual(picked[0]["id"], "dt-m1-claw-loop")
        self.assertEqual(picked[0]["_handler"], "claw")

    def test_oracle_live_mention_is_not_andre_gate(self):
        mod = self.mod
        self.assertFalse(mod._is_andre_human_gate_task({
            "intent": "report oracle_live=false STRATA 0",
        }))
        # Oracle/grok90 is STRATAGROK+vaulted — not André (2FA/captcha only)
        self.assertFalse(mod._is_andre_human_gate_task({
            "intent": "Oracle password-reset grok90",
        }))
        self.assertFalse(mod._is_andre_human_gate_task({
            "hold_until": "oracle_grok90",
            "intent": "oracle vault",
        }))

    def test_hold_released_trial_clock(self):
        mod = self.mod
        data = {"trial_ends_pt": "2026-09-16", "t3_from_pt": "2026-09-14"}
        self.assertTrue(mod.hold_released({"hold_until": None}, data))
        self.assertTrue(mod.hold_released({"hold_until": "oracle_grok90"}, data))
        self.assertFalse(mod.hold_released({"hold_until": "headscale_eval"}, data))
        # today is 2026-09-05 PT → T3/T4 held
        self.assertFalse(mod.hold_released({"hold_until": "trial_t3"}, data))
        self.assertFalse(mod.hold_released({"hold_until": "trial_ended"}, data))
        self.assertEqual(mod._trial_ends_pt(data), "2026-09-16")
        self.assertEqual(mod._t3_from_pt(data), "2026-09-14")

    def test_projected_catalog_has_taper_ids(self):
        data = json.loads(PROJ.read_text(encoding="utf-8"))
        ids = {i["id"] for i in data["items"]}
        for need in (
            "proj-ts-taper-t1", "proj-ts-taper-t2", "proj-ts-taper-t3", "proj-ts-taper-t4",
            "proj-mac-desk-operative", "proj-oracle-260826",
        ):
            self.assertIn(need, ids)
        self.assertEqual(data.get("trial_ends_pt"), "2026-09-16")
        t3 = next(i for i in data["items"] if i["id"] == "proj-ts-taper-t3")
        self.assertEqual(t3.get("hold_until"), "trial_t3")
        t1 = next(i for i in data["items"] if i["id"] == "proj-ts-taper-t1")
        self.assertEqual(t1.get("eisenhower"), "act")
        self.assertIsNone(t1.get("hold_until"))


    def test_metabol_pace_gates_handlers(self):
        """HOLD skips non-lead; STASIS skips; ALLOW runs; lane-bot HOLD does not freeze claw."""
        mod = self.mod
        bus = mod._load("desk_bus")
        state = bus.load_state()
        state["open_tasks"] = [{
            "schema": "desk.task.v1",
            "id": "dt-pace-claw",
            "owner": "openclaw@fog",
            "specialty": "claw",
            "intent": "probe",
            "status": "constrain",
            "constraints": [],
            "result": "",
            "sha": "",
        }]
        state["lanes"] = {
            "lane-openclaw": {"pace": "HOLD", "tokens_used": 28000, "tokens_limit": 33000,
                              "sample_note": "session high"},
            "lane-hermes": {"pace": "ALLOW"},
            "lane-opencode": {"pace": "ALLOW"},
            "lane-bot": {"pace": "HOLD"},
            "lane-assistant": {"pace": "ALLOW"},
        }
        bus.save_state(state)

        # HOLD on openclaw → claw not picked
        picked = mod.pick_tasks(bus.load_state(), max_n=5)
        self.assertNotIn("dt-pace-claw", {t["id"] for t in picked})

        # Bot HOLD must not freeze code/coord if those lanes ALLOW
        state = bus.load_state()
        state["open_tasks"].append({
            "schema": "desk.task.v1",
            "id": "dt-pace-code",
            "owner": "opencode@fog",
            "specialty": "code",
            "intent": "tests",
            "status": "constrain",
            "constraints": [],
            "result": "",
            "sha": "",
        })
        bus.save_state(state)
        picked2 = mod.pick_tasks(bus.load_state(), max_n=5)
        ids = {t["id"] for t in picked2}
        self.assertIn("dt-pace-code", ids)
        self.assertNotIn("dt-pace-claw", ids)

        # STASIS blocks
        state = bus.load_state()
        state["lanes"]["lane-opencode"]["pace"] = "STASIS"
        bus.save_state(state)
        picked3 = mod.pick_tasks(bus.load_state(), max_n=5)
        self.assertNotIn("dt-pace-code", {t["id"] for t in picked3})

        # ALLOW runs handler (claw) — isolate from catalog re-seed / RR diversion
        state = bus.load_state()
        state["lanes"]["lane-openclaw"]["pace"] = "ALLOW"
        state["open_tasks"] = [t for t in state["open_tasks"] if t["id"] == "dt-pace-claw"]
        bus.save_state(state)
        rr = self.tmp / "data/desk-meters/pick-rr.json"
        rr.parent.mkdir(parents=True, exist_ok=True)
        rr.write_text(json.dumps({"cursor": 0}) + "\n")  # claw first
        mod._http_ok = lambda url, timeout=6.0, retries=2: (True, "200:ok")  # type: ignore
        called = {"n": 0}
        real = mod.handler_claw
        def wrap(task, *, dry):
            called["n"] += 1
            return real(task, dry=dry)
        mod.handler_claw = wrap  # type: ignore
        mod.HANDLERS["claw"] = wrap
        mod._push = lambda bus: None  # type: ignore
        mod.record_taper_status = lambda dry=False: {"ok": True}  # type: ignore
        mod.specialty_self_audit_tick = lambda dry=False, state=None: {"ok": True}  # type: ignore
        mod.ensure_projected_catalog = lambda bus, state, dry=False: []  # type: ignore
        mod.promote_projected = lambda bus, state, dry=False: None  # type: ignore
        mod.academy_teach_tick = lambda bus, state, dry=False: None  # type: ignore
        mod.ensure_desk_surfaces_tick = lambda bus, state, dry=False: {"ok": True}  # type: ignore
        ns = type("A", (), {"max": 1, "dry_run": False})()
        rc = mod.cmd_cycle(ns)
        self.assertEqual(rc, 0)
        self.assertGreaterEqual(called["n"], 1)

    def test_handler_claw_verb_audit(self):
        mod = self.mod
        mod._http_ok = lambda url, timeout=6.0, retries=2: (True, "200:ok")  # type: ignore
        out = mod.handler_claw({"id": "dt-x", "specialty": "claw"}, dry=True)
        self.assertEqual(out.get("verb"), "audit")
        self.assertIn("fog=", out.get("result", ""))

    def test_fog_edge_briefs_nonempty(self):
        mod = self.mod
        mod._http_ok = lambda url, timeout=6.0, retries=2: (True, "200:ok")  # type: ignore
        out = mod.handler_fog({"id": "dt-fog", "intent": "origin", "specialty": "fog"}, dry=False)
        brief = self.tmp / "data/desk-outbox/fog-assistant-next.md"
        self.assertTrue(brief.is_file(), "fog brief missing")
        self.assertGreater(brief.stat().st_size, 40)
        self.assertIn("Execute", brief.read_text())
        out2 = mod.handler_edge({"id": "dt-edge", "intent": "api", "specialty": "edge"}, dry=False)
        ebrief = self.tmp / "data/desk-outbox/edge-assistant-next.md"
        self.assertTrue(ebrief.is_file())
        self.assertTrue("api-edge" in ebrief.read_text().lower() or "health" in ebrief.read_text().lower())


    def test_collegium_after_dispute(self):
        """dispute must open revise + call_vote — not a dead-end feed note."""
        mod = self.mod
        bus = mod._load("desk_bus")
        state = bus.load_state()
        state["open_tasks"] = [{
            "schema": "desk.task.v1",
            "id": "dt-edge-rl",
            "owner": "edge@fog",
            "specialty": "edge",
            "intent": "edge probe",
            "status": "constrain",
            "constraints": [],
            "history": [],
            "result": "",
            "sha": "",
        }]
        bus.save_state(state)
        out = {
            "ok": False,
            "result": "edge api=0 site=0 | 429/1015 after backoff",
            "done": False,
            "verb": "dispute",
            "peer": "refer",
            "peer_vote": True,
            "auto_cast_ack": True,
            "next_action": "edge-assistant: CF 429/1015 — revise after ≥30s",
        }
        mod.apply_result(bus, state["open_tasks"][0], out, by="edge")
        st2 = bus.load_state()
        task = bus.find_task(st2, "dt-edge-rl")
        self.assertIsNotNone(task)
        hist = [h.get("verb") for h in (task.get("history") or [])]
        self.assertIn("dispute", hist)
        self.assertIn("revise", hist)
        self.assertIn("call_vote", hist)
        diary = self.tmp / "data/desk-outbox/journals/hermes/diary.md"
        # edge maps to hermes diary via _diary_agent("edge") → hermes? check mapping
        # edge -> hermes in _diary_agent; also edge-assistant journals
        found = False
        for agent in ("hermes", "edge-assistant", "edge", "stratagrok"):
            d = self.tmp / f"data/desk-outbox/journals/{agent}/diary.md"
            if d.is_file() and "revise" in d.read_text():
                found = True
                break
        chainp = self.tmp / "data/desk-meters/last-verb-chain.json"
        if chainp.is_file():
            import json as _json
            ch = _json.loads(chainp.read_text()).get("chain") or []
            if "revise" in ch and "call_vote" in ch:
                found = True
        self.assertTrue(found, "diary/chain must show revise+call_vote after dispute")

    def test_pick_rr_does_not_starve_code(self):
        mod = self.mod
        bus = mod._load("desk_bus")
        state = bus.load_state()
        state["lanes"] = {
            "lane-openclaw": {"pace": "ALLOW"},
            "lane-hermes": {"pace": "ALLOW"},
            "lane-opencode": {"pace": "ALLOW"},
            "lane-bot": {"pace": "HOLD"},
            "lane-assistant": {"pace": "ALLOW"},
        }
        state["open_tasks"] = [
            {"schema": "desk.task.v1", "id": "dt-a-claw", "owner": "openclaw@fog",
             "specialty": "claw", "intent": "probe", "status": "propose",
             "constraints": [], "result": "", "sha": "", "eisenhower": "act"},
            {"schema": "desk.task.v1", "id": "dt-a-code", "owner": "opencode@fog",
             "specialty": "code", "intent": "tests", "status": "propose",
             "constraints": [], "result": "", "sha": "", "eisenhower": "act"},
        ]
        bus.save_state(state)
        # Force RR cursor onto claw so first pick is claw, second advances to code
        rr = self.tmp / "data/desk-meters/pick-rr.json"
        rr.parent.mkdir(parents=True, exist_ok=True)
        rr.write_text(json.dumps({"cursor": 0, "last": "lead"}) + "\n")  # claw first in order
        p1 = mod.pick_tasks(bus.load_state(), max_n=1)
        self.assertEqual(p1[0]["id"], "dt-a-claw")
        p2 = mod.pick_tasks(bus.load_state(), max_n=1)
        self.assertEqual(p2[0]["id"], "dt-a-code", "RR must advance so code is not starved")

    def test_handler_edge_rate_limit_next_action(self):
        mod = self.mod
        def fake(url, timeout=6.0, retries=2):
            return False, "429:error code 1015"
        mod._http_ok = fake  # type: ignore
        out = mod.handler_edge({"id": "dt-e", "intent": "api", "specialty": "edge"}, dry=True)
        self.assertEqual(out.get("verb"), "dispute")
        self.assertTrue(out.get("next_action"))
        self.assertTrue(out.get("peer_vote"))


if __name__ == "__main__":
    unittest.main()
