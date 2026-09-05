#!/usr/bin/env python3
"""Desk performance metrics — sustained operative score.

Writes cycle samples to:
  $FOG_HOME/data/desk-metrics.jsonl
  $FOG_HOME/data/last-cycle.jsonl   (alias mirror for Mac operative desk)

CLI:
  python3 ops/desk-collegium/desk_metrics.py score [--n 20]
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path


def _fog() -> Path:
    return Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))


def metrics_path() -> Path:
    return _fog() / "data" / "desk-metrics.jsonl"


def last_cycle_path() -> Path:
    return _fog() / "data" / "last-cycle.jsonl"


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def record(sample: dict) -> Path:
    """Append one cycle sample to desk-metrics.jsonl and last-cycle.jsonl."""
    sample = dict(sample)
    sample.setdefault("ts", _now())
    line = json.dumps(sample, ensure_ascii=False) + "\n"
    primary = metrics_path()
    mirror = last_cycle_path()
    for path in (primary, mirror):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(line)
    return primary


def score_recent(n: int = 20) -> dict:
    """Compute 0..100 operative score from recent cycle samples."""
    primary = metrics_path()
    mirror = last_cycle_path()
    src = primary if primary.is_file() else (mirror if mirror.is_file() else None)
    if src is None:
        return {"ok": False, "reason": "no_samples", "score": 0}
    lines = src.read_text(encoding="utf-8").splitlines()[-n:]
    rows = []
    for L in lines:
        try:
            rows.append(json.loads(L))
        except Exception:
            pass
    if not rows:
        return {"ok": False, "reason": "empty", "score": 0}
    delivered = sum(1 for r in rows if int(r.get("delivered") or 0) > 0)
    idle = sum(1 for r in rows if r.get("idle_skip"))
    proto = sum(1 for r in rows if r.get("protocol_ok"))
    gh_ok = sum(1 for r in rows if r.get("gh_ok"))
    token_ok = sum(1 for r in rows if r.get("token") == "present")
    total = len(rows)
    score = int(
        100
        * (
            0.35 * (delivered / total)
            + 0.25 * (1 - idle / total)
            + 0.20 * (proto / total)
            + 0.10 * (gh_ok / total)
            + 0.10 * (token_ok / total)
        )
    )
    return {
        "ok": score >= 70,
        "score": score,
        "samples": total,
        "delivered_frac": round(delivered / total, 3),
        "idle_frac": round(idle / total, 3),
        "protocol_ok_frac": round(proto / total, 3),
        "gh_ok_frac": round(gh_ok / total, 3),
        "token_present_frac": round(token_ok / total, 3),
        "target_score": 70,
        "source": str(src.name),
    }


# Back-compat alias used by callers / Mac docs
score = score_recent


def main() -> int:
    p = argparse.ArgumentParser(description="Desk metrics — operative score")
    sub = p.add_subparsers(dest="cmd", required=True)
    sc = sub.add_parser("score", help="score recent cycle samples (0..100)")
    sc.add_argument("--n", type=int, default=20, help="lookback sample count")
    args = p.parse_args()
    if args.cmd == "score":
        out = score_recent(args.n)
        print(json.dumps(out, indent=2))
        if out.get("reason") == "no_samples":
            return 0  # soft — first boot / empty FOG
        return 0 if out.get("ok") else 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
