#!/usr/bin/env python3
"""MallocStackLogging is macOS libmalloc noise, not a Fog hop fault."""
from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

_SRC = Path(__file__).resolve().parent / "fog-tui.py"
_SPEC = importlib.util.spec_from_file_location("fog_tui", _SRC)
_MOD = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
os.environ["FOG_TUI_KEEP_STDERR"] = "1"
_SPEC.loader.exec_module(_MOD)
is_mac_malloc_noise = _MOD.is_mac_malloc_noise
quiet_mac_malloc = _MOD.quiet_mac_malloc
MAC_MALLOC_ENV = _MOD.MAC_MALLOC_ENV

NOISE = "Python(16746) MallocStackLogging: can't turn off malloc stack logging because it was not enabled."
PREFIXED = "fog-tui error: " + NOISE


class MallocNoise(unittest.TestCase):
    def test_real_line(self):
        self.assertTrue(is_mac_malloc_noise(NOISE))
        self.assertTrue(is_mac_malloc_noise(PREFIXED))

    def test_real_errors_pass(self):
        self.assertFalse(is_mac_malloc_noise("launchctl: Could not find service"))
        self.assertFalse(is_mac_malloc_noise("fog-tui.py missing"))
        self.assertFalse(is_mac_malloc_noise(""))
        self.assertFalse(is_mac_malloc_noise("error: tunnel down"))

    def test_quiet_unsets_never_sets_zero(self):
        for k in MAC_MALLOC_ENV:
            os.environ[k] = "0"
        quiet_mac_malloc()
        for k in MAC_MALLOC_ENV:
            self.assertNotIn(k, os.environ)

    def test_quiet_is_idempotent(self):
        quiet_mac_malloc()
        quiet_mac_malloc()

    def test_fd2_pump_drops_noise_keeps_real(self):
        script = textwrap.dedent(
            r"""
            import os, sys, time, importlib.util
            from pathlib import Path
            src = Path(%r)
            spec = importlib.util.spec_from_file_location("fog_tui", src)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            os.environ.pop("FOG_TUI_KEEP_STDERR", None)
            mod.quiet_mac_malloc._installed = False
            mod.quiet_mac_malloc()
            os.write(2, b"Python(16746) MallocStackLogging: can't turn off malloc stack logging because it was not enabled.\n")
            os.write(2, b"fog-tui error: Python(1) MallocStackLogging: can't turn off malloc stack logging because it was not enabled.\n")
            os.write(2, b"launchctl: Could not find service\n")
            time.sleep(0.25)
            """
        ) % str(_SRC)
        r = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertNotIn("MallocStackLogging", r.stderr)
        self.assertIn("launchctl: Could not find service", r.stderr)


if __name__ == "__main__":
    unittest.main()
