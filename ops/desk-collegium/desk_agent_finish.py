#!/usr/bin/env python3
"""Close one Ollama-desk task only with evidence. NO-FAKE-DONE.

Used by deploy/mac-fog/desk-agent-run.sh after a real oneshot/probe/binary.
Never stamps ok+done because a binary exists or a meter JSON was written.

  python3 ops/desk-collegium/desk_agent_finish.py \\
      --agent opencode --ok 0 --result 'BINARY MISSING'
  python3 ops/desk-collegium/desk_agent_finish.py \\
      --agent hermes --ok 1 --result 'oneshot wrote journal' \\
      --evidence "$FOG/data/desk-outbox/journals/hermes/lesson.md"
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import desk_bus as bus  # noqa: E402
import desk_ops as ops  # noqa: E402

OWNER = {
    "opencode": "opencode",
    "hermes": "hermes",
    "openclaw": "openclaw",
    "fog": "fog",
    "edge": "edge",
}


def _evidence_ok(path: str) -> bool:
    """NO-FAKE-DONE: size alone is not evidence (stub verified-on-DATE closed T1).

    Require desk_ops._has_tool_evidence residue in the file body.
    """
    if not path:
        return False
    p = Path(path)
    if not p.is_file():
        return False
    try:
        if p.stat().st_size <= 8:
            return False
        blob = p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return False
    low = blob.lower()
    # Explicit vapour stubs Hermes/OpenCode have written as evidence
    stub_needles = (
        "act t1 verified on",
        "verified on 20",
        "no further changes needed",
        "file written, verified, and ready",
    )
    if any(s in low for s in stub_needles) and "iphone_prove" not in low:
        if "mac_addr=" not in low and "ping_10.88" not in low and "wrote status/" not in low:
            return False
    return bool(ops._has_tool_evidence(blob))


def _pick_task(state: dict, agent: str) -> dict | None:
    want = OWNER.get(agent, agent)
    open_tasks = list(state.get("open_tasks") or [])
    for t in open_tasks:
        own = str(t.get("owner") or "")
        if want in own or own.endswith(want) or own.startswith(want):
            if str(t.get("status") or "") not in ("done", "drop", "escalate"):
                return t
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", required=True)
    ap.add_argument("--ok", type=int, default=0)
    ap.add_argument("--result", default="")
    ap.add_argument("--evidence", default="")
    ap.add_argument("--verb", default="")
    args = ap.parse_args()
    agent = args.agent.strip().lower()
    ev = _evidence_ok(args.evidence)
    ok = bool(args.ok) and ev
    done = ok
    skipped = False
    verb = (args.verb or ("act" if ok else "dispute")).strip()
    result = args.result or ("evidence " + args.evidence if ev else "no evidence — not done")
    out = ops.honest_result(
        ok=ok,
        done=done,
        verb=verb,
        result=result,
        evidence=ev,
        skipped=skipped,
    )
    state = bus.load_state()
    task = _pick_task(state, agent)
    meter_dir = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog")) / "data" / "desk-meters"
    meter_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "agent": agent,
        "ok": out["ok"],
        "done": out["done"],
        "evidence": out["evidence"],
        "skipped": out["skipped"],
        "verb": out["verb"],
        "result": out["result"][:240],
        "task_id": (task or {}).get("id"),
    }
    (meter_dir / f"{agent}.json").write_text(json.dumps(payload, indent=2) + "\n")
    if not task:
        print(json.dumps({"ok": False, "done": False, "reason": "no open task for agent", **payload}, indent=2))
        return 1
    ops.apply_result(bus, task, out, by=agent)
    print(json.dumps({"applied": True, **payload}, indent=2))
    return 0 if out["ok"] and out["done"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
