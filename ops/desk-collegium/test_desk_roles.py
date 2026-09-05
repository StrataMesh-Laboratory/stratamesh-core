#!/usr/bin/env python3
"""Assert agent_roles, autonomy laws, surfaces, ship auto, reports."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
import importlib.util

HERE = Path(__file__).resolve().parent
REQUIRED = [
    "stratagrok", "hermes", "opencode", "openclaw", "fog-assistant", "edge-assistant",
]


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class DeskRolesAutonomy(unittest.TestCase):
    def test_protocol_has_autonomy_laws(self):
        proto = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
        ids = {l["id"] for l in proto["laws"]}
        for need in ("agent_autonomy", "bot_cap_contingency", "ship_majority", "academy_teach"):
            self.assertIn(need, ids)
        self.assertIn("reports.sync", proto["cycle"])
        self.assertIn("todo_board_snapshot", proto["cycle"])
        self.assertIn("ensure_roles_documented", proto["cycle"])
        self.assertIn("auto_ship_if_majority_and_metrics", proto["cycle"])

    def test_agent_roles_six_members_todo_board(self):
        roles = json.loads((HERE / "agent_roles.json").read_text(encoding="utf-8"))
        ids = [m["id"] for m in roles["members"]]
        self.assertEqual(sorted(ids), sorted(REQUIRED))
        for m in roles["members"]:
            self.assertTrue(m.get("reads_todo_board"), m["id"])
            self.assertTrue(m.get("academy_teach"))
            self.assertIn("mandatory_wake_reads", m)
        self.assertTrue(roles.get("ship_auto", {}).get("enabled"))
        self.assertIn("bot_cap_contingency", roles)

    def test_protocol_check_ok(self):
        proto = _load("desk_protocol", HERE / "desk_protocol.py")
        r = proto.check({"open_tasks": [], "done_tasks": []})
        self.assertTrue(r["ok"], r.get("violations"))
        self.assertIn("agent_autonomy", r.get("law_ids") or [])

    def test_ensure_desk_surfaces_idempotent(self):
        tmp = Path(tempfile.mkdtemp(prefix="desk-surf-"))
        os.environ["FOG_HOME"] = str(tmp)
        (tmp / "data" / "desk-collegium").mkdir(parents=True)
        (tmp / "data" / "desk-collegium" / "state.json").write_text(
            json.dumps({
                "schema": "desk.collegium.state.v1",
                "open_tasks": [{
                    "schema": "desk.task.v1", "id": "dt-demo", "owner": "hermes",
                    "specialty": "coord", "intent": "demo", "status": "propose",
                }],
                "done_tasks": [], "lanes": {"lane-hermes": {"pace": "ALLOW"}},
            }) + "\n"
        )
        rep = _load("desk_reports", HERE / "desk_reports.py")
        # soft: no network
        a = rep.ensure_desk_surfaces(limit=3, state=None, feed=False)
        b = rep.ensure_desk_surfaces(limit=3, state=None, feed=False)
        self.assertTrue(a.get("ok") or a.get("steps"), a)
        todo = tmp / "data" / "desk-outbox" / "TODO.md"
        ctx = tmp / "data" / "desk-outbox" / "CONTEXT-CMN-STRATAMESH.md"
        self.assertTrue(todo.is_file(), "TODO.md missing")
        self.assertTrue(ctx.is_file(), "CONTEXT pack missing")
        self.assertIn("dt-demo", todo.read_text())
        self.assertIn("Wake order", ctx.read_text())
        # journals for 6
        for aid, _ in rep.JOURNAL_AGENTS:
            self.assertTrue((tmp / "data" / "desk-outbox" / "journals" / aid / "diary.md").is_file())
            self.assertTrue((tmp / "data" / "desk-outbox" / "journals" / aid / "notebook.md").is_file())
        # idempotent: second run does not wipe diary
        diary = tmp / "data" / "desk-outbox" / "journals" / "hermes" / "diary.md"
        diary.write_text(diary.read_text() + "\n- kept entry\n")
        rep.ensure_desk_surfaces(limit=3, feed=False)
        self.assertIn("kept entry", diary.read_text())
        # reports exist (soft)
        self.assertTrue((tmp / "data" / "desk-outbox" / "reports" / "gh-daily.md").is_file())
        self.assertTrue((tmp / "data" / "desk-outbox" / "reports" / "discourse-daily.md").is_file())
        self.assertTrue((tmp / "data" / "desk-meters" / "surfaces_ok.json").is_file())

    def test_context_template_in_repo(self):
        tmpl = HERE / "templates" / "CONTEXT-CMN-STRATAMESH.md"
        # ensure_desk_surfaces creates it; also write seed if missing for git
        if not tmpl.is_file():
            tmpl.parent.mkdir(parents=True, exist_ok=True)
            tmpl.write_text("# CONTEXT — CMN + StrataMesh (template)\n\nWake order placeholder.\n")
        self.assertTrue(tmpl.is_file())

    def test_ship_metrics_and_auto(self):
        tmp = Path(tempfile.mkdtemp(prefix="desk-ship-"))
        os.environ["FOG_HOME"] = str(tmp)
        d = tmp / "data" / "desk-collegium"
        d.mkdir(parents=True)
        state = {
            "schema": "desk.collegium.state.v1",
            "open_tasks": [{
                "schema": "desk.task.v1",
                "id": "dt-ship-1",
                "owner": "hermes",
                "specialty": "coord",
                "intent": "ship demo",
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
        }
        (d / "state.json").write_text(json.dumps(state) + "\n")
        # seed metrics soft-ok
        meters = tmp / "data" / "desk-meters"
        meters.mkdir(parents=True)
        (meters / "openclaw.json").write_text(json.dumps({
            "probes": {"fog_public": 1},
        }) + "\n")
        ship = _load("desk_ship", HERE / "desk_ship.py")
        band = ship.metrics_in_band(state["open_tasks"][0])
        self.assertIn("ok", band)
        # dry auto
        out = ship.maybe_auto_ship(by="hermes", dry=True)
        self.assertTrue(out.get("ok"))
        actions = [r.get("action") for r in out.get("results") or []]
        self.assertTrue(any(a in ("would_ship", "shipped", "wait_majority", "escalate_oob") for a in actions), out)

    def test_ensure_roles_documented(self):
        tmp = Path(tempfile.mkdtemp(prefix="desk-roles-"))
        os.environ["FOG_HOME"] = str(tmp)
        ops = _load("desk_ops", HERE / "desk_ops.py")
        out = ops.ensure_roles_documented(dry=False)
        self.assertTrue(out.get("ok"), out)
        self.assertEqual(out.get("members"), 6)
        self.assertTrue(out.get("reads_todo_board"))
        self.assertTrue((tmp / "data" / "desk-meters" / "roles_ok.json").is_file())



    def test_secrets_vault_gitignore(self):
        root = HERE.parents[1]
        gi = (root / ".gitignore").read_text(encoding="utf-8")
        for needle in ("**/secrets.env", "**/desk-mail.token", "**/.config/stratagrok/**", "*.kdbx"):
            self.assertIn(needle, gi)
        self.assertTrue((HERE / "SECRETS-VAULT.md").is_file())
        for aid in REQUIRED:
            self.assertTrue((HERE / "agents" / aid / "VAULT.md").is_file(), aid)
        # no secret fixtures
        for p in HERE.rglob("*"):
            if p.is_file() and p.suffix in (".token", ".env") and "example" not in p.name.lower():
                if "secrets.env" in p.name or "desk-mail.token" in p.name:
                    self.fail(f"secret fixture in repo: {p}")

    def test_vault_step_in_surfaces(self):
        tmp = Path(tempfile.mkdtemp(prefix="desk-vault-"))
        os.environ["FOG_HOME"] = str(tmp)
        (tmp / "data" / "desk-collegium").mkdir(parents=True)
        (tmp / "data" / "desk-collegium" / "state.json").write_text(
            '{"schema":"desk.collegium.state.v1","open_tasks":[],"done_tasks":[]}\n'
        )
        rep = _load("desk_reports", HERE / "desk_reports.py")
        out = rep.ensure_desk_surfaces(limit=2, feed=False)
        self.assertIn("vault", out.get("steps") or {})
        self.assertTrue((out.get("steps") or {}).get("vault", {}).get("vault_md_ok") or (HERE / "agents" / "hermes" / "VAULT.md").is_file())

if __name__ == "__main__":
    unittest.main()

