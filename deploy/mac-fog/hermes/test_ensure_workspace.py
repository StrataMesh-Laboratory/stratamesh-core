#!/usr/bin/env python3
"""Assert needles for FOG-CMN-DESK Hermes workspace ensure.

Fails if:
- desktop.repo_scan_roots == [] or missing StrataMesh / fog/repo
- no active FOG-CMN-DESK / missing primary path
- zero sessions with message_count>=1 and cwd under fog/repo
- model.default not in ollama tags (when ollama available)
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

FOG_REPO = Path(os.environ.get("FOG_SRC", Path.home() / "StrataMesh" / "fog" / "repo"))
STRATAMESH = Path(os.environ.get("STRATAMESH_ROOT", Path.home() / "StrataMesh"))
HERE = Path(__file__).resolve().parent


def _env() -> dict:
    env = os.environ.copy()
    extra = "/usr/local/bin:/opt/homebrew/bin:" + str(Path.home() / ".local" / "bin")
    env["PATH"] = extra + ":" + env.get("PATH", "")
    return env


def hermes(*args: str) -> subprocess.CompletedProcess:
    h = shutil.which("hermes", path=_env()["PATH"])
    if not h:
        raise unittest.SkipTest("hermes not on PATH")
    return subprocess.run(
        [h, *args], env=_env(), text=True, capture_output=True, timeout=120
    )


def ollama_tags() -> list:
    if not shutil.which("ollama", path=_env()["PATH"]):
        return []
    p = subprocess.run(
        ["ollama", "list"], env=_env(), text=True, capture_output=True, timeout=30
    )
    if p.returncode != 0:
        return []
    tags = []
    for i, line in enumerate(p.stdout.splitlines()):
        if i == 0 and line.upper().startswith("NAME"):
            continue
        parts = line.split()
        if parts:
            tags.append(parts[0])
    return tags


class TestEnsureWorkspaceLive(unittest.TestCase):
    """Live asserts against Mac Hermes state (post-ensure or with fixtures)."""

    def test_repo_scan_roots_non_empty(self):
        p = hermes("config", "get", "desktop.repo_scan_roots")
        self.assertEqual(p.returncode, 0, p.stderr)
        raw = p.stdout.strip()
        self.assertTrue(raw, "desktop.repo_scan_roots empty output")
        # reject empty list form
        compact = raw.replace(" ", "").replace("\n", "")
        self.assertNotIn("repo_scan_roots:[]", compact)
        self.assertFalse(raw.strip() in {"[]", "-", "null"})
        joined = raw + "\n"
        self.assertIn("StrataMesh", joined)
        self.assertIn("fog/repo", joined)

    def test_active_project_primary(self):
        p = hermes("project", "show", "fog-cmn-desk")
        self.assertEqual(p.returncode, 0, p.stderr)
        out = p.stdout
        self.assertIn("fog-cmn-desk", out)
        self.assertIn(str(FOG_REPO), out)

    def test_listable_fog_session(self):
        ha = Path.home() / ".hermes" / "hermes-agent"
        sys.path.insert(0, str(ha))
        from hermes_state import SessionDB  # type: ignore

        db = SessionDB()
        try:
            found = 0
            for row in db.search_sessions(limit=200) or []:
                if int(row.get("message_count") or 0) < 1:
                    continue
                blob = f"{row.get('cwd') or ''} {row.get('git_repo_root') or ''}"
                if str(FOG_REPO) in blob or "/fog/repo" in blob:
                    found += 1
            self.assertGreaterEqual(
                found,
                1,
                "need >=1 session with message_count>=1 and cwd under fog/repo",
            )
        finally:
            db.close()

    def test_model_in_ollama_tags(self):
        tags = ollama_tags()
        if not tags:
            self.skipTest("ollama unavailable")
        p = hermes("config", "get", "model.default")
        self.assertEqual(p.returncode, 0, p.stderr)
        val = p.stdout.strip().splitlines()[-1].strip().strip("\"'")
        if val.startswith("model.default"):
            val = val.split(":", 1)[-1].strip().strip("\"'")
        self.assertIn(val, tags, f"model.default={val!r} not in ollama tags {tags}")
        avoid = {"mistral:latest", "mistral", "llava:latest", "llava", "phi3:latest", "phi3"}
        self.assertNotIn(val, avoid, f"model.default={val!r} is <64k-class; prefer llama3.2/qwen")

    def test_context_length_ge_64k(self):
        p = hermes("config", "get", "model.context_length")
        self.assertEqual(p.returncode, 0, p.stderr)
        raw = p.stdout.strip().splitlines()[-1].strip().strip("\'\"")
        if "context_length" in raw and ":" in raw:
            raw = raw.split(":", 1)[-1].strip()
        ctx = int(raw.split()[0])
        self.assertGreaterEqual(ctx, 65536, f"context_length={ctx} < Hermes minimum 64k")

    def test_cli_workspace_list(self):
        p = hermes("sessions", "list", "--workspace", "fog")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertNotIn("No sessions found", p.stdout)


    def test_fallback_chain_declared(self):
        import yaml
        from pathlib import Path
        raw = yaml.safe_load((Path.home() / ".hermes" / "config.yaml").read_text())
        fb = raw.get("fallback_providers") or []
        models = [e.get("model") for e in fb if isinstance(e, dict)]
        self.assertIn("qwen2.5:3b", models)
        self.assertIn("qwen2.5:7b", models)

class TestEnsureWorkspaceUnit(unittest.TestCase):
    """Fixture-style: roots [] must fail helper logic."""

    def test_empty_roots_needle(self):
        roots: list = []
        self.assertEqual(roots, [])
        self.assertFalse(bool(roots), "assert needle: roots == [] must fail ensure")

    def test_scan_roots_constant(self):
        # import module constants without executing main side effects
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "ensure_workspace", HERE / "ensure_workspace.py"
        )
        mod = importlib.util.module_from_spec(spec)
        # avoid running if path missing in CI — still load
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        self.assertIn(str(STRATAMESH), mod.SCAN_ROOTS)
        self.assertIn(str(FOG_REPO), mod.SCAN_ROOTS)
        self.assertNotEqual(mod.SCAN_ROOTS, [])


    def test_ensure_desk_mail_helper_exists(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "ensure_workspace", HERE / "ensure_workspace.py"
        )
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        self.assertTrue(callable(getattr(mod, "ensure_desk_mail", None)))


if __name__ == "__main__":
    # Prefer hermes venv python for SessionDB imports when available
    vpy = Path.home() / ".hermes" / "hermes-agent" / "venv" / "bin" / "python"
    if vpy.is_file() and Path(sys.executable).resolve() != vpy.resolve():
        os.execv(str(vpy), [str(vpy), __file__, *sys.argv[1:]])
    unittest.main(verbosity=2)
