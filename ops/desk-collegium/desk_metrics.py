#!/usr/bin/env python3
"""Desk performance metrics — sustained operative score."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
import os

FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
METRICS = FOG / "data" / "desk-metrics.jsonl"


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def record(sample: dict) -> Path:
    METRICS.parent.mkdir(parents=True, exist_ok=True)
    sample = dict(sample)
    sample["ts"] = _now()
    with METRICS.open("a", encoding="utf-8") as f:
        f.write(json.dumps(sample, ensure_ascii=False) + "\n")
    return METRICS


def score_recent(n: int = 20) -> dict:
    if not METRICS.is_file():
        return {"ok": False, "reason": "no_samples", "score": 0}
    lines = METRICS.read_text(encoding="utf-8").splitlines()[-n:]
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
    # score 0..100
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
    }


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("score")
    args = p.parse_args()
    if args.cmd == "score":
        print(json.dumps(score_recent(), indent=2))
        return 0 if score_recent().get("ok") else 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
