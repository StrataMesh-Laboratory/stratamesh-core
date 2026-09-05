#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import os
import unittest
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "ollama_local", Path(__file__).resolve().parent / "ollama_local.py"
)
_MOD = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(_MOD)


class OllamaLocal(unittest.TestCase):
    def test_refuse_nonlocal_host(self):
        os.environ["OLLAMA_HOST"] = "https://ollama.example.com"
        os.environ.pop("OLLAMA_ALLOW_NONLOCAL", None)
        with self.assertRaises(SystemExit):
            _MOD._host()

    def test_allow_loopback(self):
        os.environ["OLLAMA_HOST"] = "http://127.0.0.1:11434"
        self.assertIn("127.0.0.1", _MOD._host())

    def test_wizard_dry_run(self):
        os.environ["OLLAMA_HOST"] = "http://127.0.0.1:11434"
        out = _MOD.wizard("account", dry_run=True)
        self.assertTrue(out["ok"])
        self.assertTrue(out["dry_run"])
        self.assertIn("account", out["system"])


    def test_fail_open_when_chat_down(self):
        os.environ["OLLAMA_HOST"] = "http://127.0.0.1:11434"
        real = _MOD.chat
        def boom(*a, **k):
            return {"ok": False, "error": "simulated_down"}
        _MOD.chat = boom
        try:
            out = _MOD.wizard("join-mesh", "please join")
        finally:
            _MOD.chat = real
        self.assertTrue(out["ok"])
        self.assertTrue(out.get("fail_open"))
        self.assertEqual(out["json"]["flow"], "join-mesh")

if __name__ == "__main__":
    unittest.main()
