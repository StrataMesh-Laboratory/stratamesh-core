#!/usr/bin/env python3
"""#40 honesty: Agora settlements at f_max=0 is an envelope, not a scalar 0.

In-process only. Does not probe Fog, Workers, or public URLs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from agora import Agora, settlements_honesty


def test_envelope_at_f_max_0():
    env = settlements_honesty(0, f_max=0)
    assert env == {"unavailable": "f_max=0"}
    assert not isinstance(env, int)
    assert json.loads(json.dumps(env)) == env


def test_seed_log_cannot_become_quality_at_f_max_0():
    env = settlements_honesty(7, f_max=0)
    assert env == {"unavailable": "f_max=0"}
    assert env != 7


def test_number_only_when_f_max_positive():
    assert settlements_honesty(0, f_max=1) == 0
    assert settlements_honesty(4, f_max=1) == 4


def test_book_not_scalar_at_lab_f_max_0():
    book = Agora().book()
    s = book["settlements"]
    assert not isinstance(s, int), s
    assert s == {"unavailable": "f_max=0"}
    assert json.loads(json.dumps(book))["settlements"]["unavailable"] == "f_max=0"


def test_book_ignores_seed_log_at_f_max_0():
    a = Agora()
    a.settlement_log = [{"seed": True}] * 4
    s = a.book()["settlements"]
    assert s == {"unavailable": "f_max=0"}
    assert s != 4


if __name__ == "__main__":
    failed = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok", name)
            except Exception as e:
                failed += 1
                print("FAIL", name, type(e).__name__, e)
    if failed:
        sys.exit(1)
    print("status settlements honesty ok")
