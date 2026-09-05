#!/usr/bin/env python3
"""Append one line to Fog TUI live desk feed (FOG/data/desk-feed.jsonl).

Usage:
  desk-feed-append.py hermes "propose: OpenCode patch auth hop" --kind propose --specialty coord
  desk-feed-append.py opencode "constrain: ok" --kind constrain
  desk-feed-append.py openclaw "local :18789 up" --kind say
  desk-feed-append.py stratagrok "Eisenhower: Act desk-feed live" --kind say
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
FEED = FOG / "data" / "desk-feed.jsonl"


def append(agent: str, text: str, *, kind: str = "say", specialty: str = "") -> Path:
    FEED.parent.mkdir(parents=True, exist_ok=True)
    rec = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "t": time.strftime("%H:%M:%S"),
        "agent": (agent or "desk")[:32],
        "kind": (kind or "say")[:16],
        "specialty": (specialty or "")[:16],
        "text": (text or "")[:240],
    }
    with FEED.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        f.flush()
    return FEED


def main() -> int:
    p = argparse.ArgumentParser(description="Append to Fog TUI desk-feed.jsonl")
    p.add_argument("agent", help="hermes|opencode|openclaw|stratagrok|…")
    p.add_argument("text", help="chat line (≤240 chars)")
    p.add_argument("--kind", default="say", help="say|propose|constrain|revise|commit|escalate")
    p.add_argument("--specialty", default="", help="coord|code|claw|lead|…")
    args = p.parse_args()
    path = append(args.agent, args.text, kind=args.kind, specialty=args.specialty)
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
