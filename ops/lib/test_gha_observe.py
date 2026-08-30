#!/usr/bin/env python3
"""gha_observe contract: WAF/hop/timeout is HOLD, not a red check."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gha_observe import TRANSIENT_HTTP, fetch_json, is_hold_http

assert 403 in TRANSIENT_HTTP and 429 in TRANSIENT_HTTP and 0 in TRANSIENT_HTTP
assert is_hold_http(403) and is_hold_http(530) and not is_hold_http(500)
hit = fetch_json("https://workers.dev/nope")
assert hit.get("hard") is True
print("ok gha_observe hold-contract")
