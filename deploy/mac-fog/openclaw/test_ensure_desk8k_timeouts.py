#!/usr/bin/env python3
"""Unit tests for ensure-desk8k-timeouts (no live OpenClaw)."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
MOD_PATH = HERE / "ensure-desk8k-timeouts.py"


def _load():
    spec = importlib.util.spec_from_file_location("ensure_desk8k_timeouts", MOD_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class EnsureDesk8kTimeouts(unittest.TestCase):
    def setUp(self):
        self.mod = _load()

    def _good(self):
        return {
            "agents": {
                "defaults": {
                    "timeoutSeconds": 900,
                    "experimental": {"localModelLean": True},
                    "model": {
                        "primary": "ollama/qwen2.5:3b-desk8k",
                        "fallbacks": ["ollama/qwen2.5:3b"],
                    },
                }
            },
            "models": {
                "providers": {
                    "ollama": {
                        "api": "ollama",
                        "baseUrl": "http://127.0.0.1:11434",
                        "timeoutSeconds": 900,
                    }
                }
            },
            "tools": {"toolSearch": False},
        }

    def test_strips_retired_llm_and_toolcall(self):
        d = self._good()
        d["agents"]["defaults"]["llm"] = {"idleTimeoutSeconds": 600}
        d["agents"]["defaults"]["toolCallTimeoutSeconds"] = 180
        need = self.mod._needed(d)
        self.assertTrue(any(x.startswith("retired:") for x in need))
        self.mod.apply(d)
        ad = d["agents"]["defaults"]
        self.assertNotIn("llm", ad)
        self.assertNotIn("toolCallTimeoutSeconds", ad)
        self.assertEqual(self.mod._needed(d), [])
        self.assertIs(d.get("tools", {}).get("toolSearch"), False)

    def test_strips_v1_baseurl(self):
        d = {
            "agents": {"defaults": {}},
            "models": {
                "providers": {
                    "ollama": {
                        "api": "openai-completions",
                        "baseUrl": "http://127.0.0.1:11434/v1",
                        "timeoutSeconds": 60,
                    }
                }
            },
        }
        self.mod.apply(d)
        o = d["models"]["providers"]["ollama"]
        self.assertEqual(o["api"], "ollama")
        self.assertEqual(o["baseUrl"], "http://127.0.0.1:11434")
        self.assertGreaterEqual(o["timeoutSeconds"], 900)

    def test_check_cli_on_temp_config(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "openclaw.json"
            p.write_text(json.dumps(self._good()) + "\n", encoding="utf-8")
            self.assertEqual(self.mod.main(["--config", str(p), "--check"]), 0)


if __name__ == "__main__":
    unittest.main()
