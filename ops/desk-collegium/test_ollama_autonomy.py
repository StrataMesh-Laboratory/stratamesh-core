#!/usr/bin/env python3
"""Ollama specialty autonomy + honesty: owner→handler, seeder exists, no NameError."""
from __future__ import annotations

import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load_ops(fog: Path):
    os.environ["FOG_HOME"] = str(fog)
    spec = importlib.util.spec_from_file_location("desk_ops_autonomy", ROOT / "ops/desk-collegium/desk_ops.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    mod.FOG = fog
    return mod


class OllamaAutonomy(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="ollama-aut-"))
        (self.tmp / "data" / "desk-outbox").mkdir(parents=True)
        (self.tmp / "data" / "desk-meters").mkdir(parents=True)
        self.ops = _load_ops(self.tmp)

    def test_handler_from_owner_without_specialty(self):
        self.assertEqual(self.ops._handler_for({"owner": "openclaw@fog", "intent": "probe"}), "claw")
        self.assertEqual(self.ops._handler_for({"owner": "opencode@fog", "intent": "TODO item"}), "code")
        self.assertEqual(self.ops._handler_for({"owner": "hermes@fog", "intent": "lesson"}), "coord")

    def test_ensure_seeder_exists_and_writes_briefs(self):
        self.assertTrue(callable(self.ops._ensure_ollama_specialists_on_board))
        self.assertTrue(callable(self.ops._refresh_ollama_autonomy_briefs))

        class Bus:
            def __init__(self):
                self.state = {
                    "open_tasks": [
                        {"id": "dt-h", "owner": "hermes", "intent": "teach", "status": None},
                        {"id": "dt-c", "owner": "openclaw", "intent": "hops", "status": None},
                        {"id": "dt-o", "owner": "opencode", "intent": "todo", "status": None},
                    ]
                }

            def save_state(self, st):
                self.state = st

        bus = Bus()
        touched = self.ops._refresh_ollama_autonomy_briefs(bus, bus.state)
        self.assertEqual(set(touched), {"dt-h", "dt-c", "dt-o"})
        for name in ("hermes-next.md", "openclaw-next.md", "opencode-next.md"):
            p = self.tmp / "data" / "desk-outbox" / name
            self.assertTrue(p.is_file(), name)
            self.assertGreater(p.stat().st_size, 20)
        self.assertEqual(bus.state["open_tasks"][0]["status"], "propose")

    def test_auto_update_hooks_desk_agent_run(self):
        sh = (ROOT / "deploy/mac-fog/fog-auto-update.sh").read_text(encoding="utf-8")
        self.assertIn("desk-agent-run.sh", sh)
        self.assertIn("ollama-rr.json", sh)
        self.assertIn("never stack", sh.lower() or sh)


if __name__ == "__main__":
    unittest.main()
