#!/usr/bin/env python3
"""Router: Actions → desk-prepare (labor). Grok → desk-execute (git+live+discourse).

GitHub Actions must never PUT Workers or POST Discourse. That execute stays on Grok.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
target = "ops/bin/desk-prepare.py" if os.environ.get("GITHUB_ACTIONS") else "ops/bin/desk-execute.py"
path = ROOT / target
os.execv(sys.executable, [sys.executable, str(path), *sys.argv[1:]])
