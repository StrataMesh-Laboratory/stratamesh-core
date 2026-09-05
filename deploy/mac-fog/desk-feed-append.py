#!/usr/bin/env python3
"""Append one line to Fog TUI live desk feed (FOG/data/desk-feed.jsonl).

Uses desk_feed: collegium verbs + 5min digest dedupe.
Prefer audit|act|revise|dispute over opaque say.

Usage:
  desk-feed-append.py openclaw "hops fog=1 edge=1 :8787=1 | tokens 2100/33000" --kind audit --specialty claw
  desk-feed-append.py desk "surfaces TODO+CONTEXT+reports+journals ok" --kind act --specialty coord
  desk-feed-append.py openclaw "actions: gh unavailable (PATH/auth)" --kind dispute --specialty claw
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import sys
from pathlib import Path

FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
REPO = Path(os.environ.get("FOG_SRC") or (FOG / "repo"))


def _load_feed():
    for cand in (
        REPO / "ops/desk-collegium/desk_feed.py",
        Path(__file__).resolve().parents[2] / "ops/desk-collegium/desk_feed.py",
    ):
        if cand.is_file():
            spec = importlib.util.spec_from_file_location("desk_feed", cand)
            mod = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(mod)
            return mod
    return None


def append(agent: str, text: str, *, kind: str = "act", specialty: str = "") -> Path:
    mod = _load_feed()
    if mod:
        out = mod.append(agent, text, kind=kind, specialty=specialty, fog=FOG)
        return FOG / "data" / "desk-feed.jsonl"
    # fallback raw
    import json, time
    path = FOG / "data" / "desk-feed.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    k = "act" if kind in ("say", "", None) else kind
    rec = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "t": time.strftime("%H:%M:%S"),
        "agent": (agent or "desk")[:32],
        "kind": (k or "act")[:16],
        "specialty": (specialty or "")[:16],
        "text": (text or "")[:240],
    }
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        f.flush()
    return path


def main() -> int:
    p = argparse.ArgumentParser(description="Append to Fog TUI desk-feed.jsonl")
    p.add_argument("agent", help="hermes|opencode|openclaw|stratagrok|desk|…")
    p.add_argument("text", help="compact tech payload (≤240 chars)")
    p.add_argument("--kind", default="act",
                   help="audit|act|revise|dispute|propose|… (say→act)")
    p.add_argument("--specialty", default="", help="coord|code|claw|lead|…")
    p.add_argument("--force", action="store_true", help="bypass 5min digest dedupe")
    args = p.parse_args()
    mod = _load_feed()
    if mod:
        out = mod.append(
            args.agent, args.text, kind=args.kind, specialty=args.specialty,
            fog=FOG, force=args.force,
        )
        print(FOG / "data" / "desk-feed.jsonl", "deduped" if out.get("deduped") else "wrote")
    else:
        print(append(args.agent, args.text, kind=args.kind, specialty=args.specialty))
    return 0


if __name__ == "__main__":
    sys.exit(main())
