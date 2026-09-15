#!/usr/bin/env python3
"""Close one Ollama-desk task only with evidence. NO-FAKE-DONE.

Used by deploy/mac-fog/desk-agent-run.sh after a real oneshot/probe/binary.
Never stamps ok+done because a binary exists or a meter JSON was written.

  python3 ops/desk-collegium/desk_agent_finish.py \\
      --agent opencode --ok 0 --result 'BINARY MISSING'
  python3 ops/desk-collegium/desk_agent_finish.py \\
      --agent hermes --ok 1 --result 'oneshot wrote journal' \\
      --evidence "$FOG/data/desk-outbox/journals/hermes/lesson.md"
  python3 ops/desk-collegium/desk_agent_finish.py \\
      --agent hermes --ok 1 --task-id dt-proj-academy-daily-exams \\
      --evidence status/academy_prove.txt --done 0
"""
from __future__ import annotations

import argparse
import json
import os
import re
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

_TASK_ID_RE = re.compile(r"\b(dt-[a-z0-9][a-z0-9-]{2,80})\b", re.I)


def _evidence_ok(path: str) -> bool:
    """NO-FAKE-DONE: size alone is not evidence (stub verified-on-DATE closed T1).

    Prefer desk_ops._has_tool_evidence residue. Also accept fresh status/*prove*
    bodies with concrete Mac/WG markers (operator residual proves), never vapour
    stubs.
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
        "please confirm",
        "would you like me",
        "shall i proceed",
        "opencode run wrote log",
    )
    if any(s in low for s in stub_needles) and "iphone_prove" not in low:
        if "mac_addr=" not in low and "ping_10.88" not in low and "wrote status/" not in low:
            return False
    if ops._has_tool_evidence(blob):
        return True
    # Status residual proves: real command output, not oneshot chrome.
    name = p.name.lower()
    under_status = "status" in {x.lower() for x in p.parts}
    prove_name = "prove" in name
    markers = (
        "utun9:",
        "10.88.0.2",
        "ping 10.88.0.1",
        "packets received",
        "asymmetric=",
        "iphone_faked=false",
        "local8787=",
        "git_head=",
        "box_to_mac_tcp",
        "task=dt-",
        "academy_rc=",
        "sha=",
        "fog_public=1",
        "edge_api=1",
        "local=1",
        "workerd=1",
        "openclaw-hop-prove",
        "probe_rc=0",
    )
    marker_hits = sum(1 for m in markers if m in low)
    if under_status and prove_name and marker_hits >= 3 and len(blob) >= 120:
        return True
    # Claw hop log residue (even if not under status/): require hop ones + task id
    if ("fog_public=1" in low and "edge_api=1" in low and ("local=1" in low or "ok=1" in low)
            and "dt-ollama-claw-board" in low and len(blob) >= 80):
        return True
    return False


def _ids_in_text(text: str) -> list[str]:
    if not text:
        return []
    found: list[str] = []
    for m in _TASK_ID_RE.finditer(text):
        tid = m.group(1)
        if tid not in found:
            found.append(tid)
    return found


def _commitment_ids(evidence: str, result: str) -> list[str]:
    """Task ids named in evidence body and/or result — commitment residue."""
    blob = result or ""
    if evidence:
        p = Path(evidence)
        if p.is_file():
            try:
                blob = blob + "\n" + p.read_text(encoding="utf-8", errors="replace")
            except OSError:
                pass
            # also filename / path fragments
            blob = blob + "\n" + str(p)
    return _ids_in_text(blob)


def _pick_task(state: dict, agent: str, task_id: str = "") -> dict | None:
    open_tasks = list(state.get("open_tasks") or [])
    if task_id:
        for t in open_tasks:
            if str(t.get("id") or "") == task_id:
                return t
        return None
    want = OWNER.get(agent, agent)
    # Prefer in-flight act/commit over a random first owned propose.
    preferred_status = ("act", "commit", "revise", "constrain")
    owned = []
    for t in open_tasks:
        own = str(t.get("owner") or "")
        if want in own or own.endswith(want) or own.startswith(want):
            if str(t.get("status") or "") not in ("done", "drop", "escalate"):
                owned.append(t)
    preferred = []
    for st in preferred_status:
        for t in owned:
            if str(t.get("status") or "") == st:
                preferred.append(t)
    # Ambiguous: multiple in-flight owned Acts — caller must pass --task-id
    # (P0: finishing academy evidence must not close an unrelated T2).
    uniq_pref = []
    seen = set()
    for t in preferred:
        tid = str(t.get("id") or "")
        if tid and tid not in seen:
            seen.add(tid)
            uniq_pref.append(t)
    if len(uniq_pref) > 1:
        return None
    if len(uniq_pref) == 1:
        return uniq_pref[0]
    return owned[0] if owned else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", required=True)
    ap.add_argument("--ok", type=int, default=0)
    ap.add_argument("--result", default="")
    ap.add_argument("--evidence", default="")
    ap.add_argument("--verb", default="")
    ap.add_argument("--task-id", default="", help="Bind finish to this desk_bus task id")
    ap.add_argument(
        "--done",
        type=int,
        default=-1,
        help="1=close task, 0=leave open with evidence, -1=default (same as ok)",
    )
    args = ap.parse_args()
    agent = args.agent.strip().lower()
    ev = _evidence_ok(args.evidence)
    ok = bool(args.ok) and ev
    if args.done < 0:
        done = ok
    else:
        done = bool(args.done) and ok
    skipped = False
    # Incomplete Act with real evidence amends/acts — do not dispute a peer task.
    if args.verb:
        verb = args.verb.strip()
    elif ok:
        verb = "act"
    elif ev:
        verb = "act"
    else:
        verb = "dispute"
    result = args.result or ("evidence " + args.evidence if ev else "no evidence — not done")

    explicit = (args.task_id or "").strip()
    committed = _commitment_ids(args.evidence, result)
    if not explicit and len(committed) == 1:
        explicit = committed[0]
    if explicit and committed:
        # Evidence named a different task than the bind — refuse (evidence≠commitment).
        if explicit not in committed and any(c != explicit for c in committed):
            # allow evidence that names bind + peers; hard-fail only if bind absent
            # and a different dt-* is the only/primary claim
            if explicit not in committed:
                payload = {
                    "ok": False,
                    "done": False,
                    "reason": "evidence_commitment_mismatch",
                    "task_id": explicit,
                    "commitment_ids": committed,
                    "result": result[:240],
                }
                print(json.dumps(payload, indent=2))
                return 2

    out = ops.honest_result(
        ok=ok,
        done=done,
        verb=verb,
        result=result,
        evidence=ev,
        skipped=skipped,
    )
    state = bus.load_state()
    task = _pick_task(state, agent, task_id=explicit)
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
        "task_id": (task or {}).get("id") or (explicit or None),
        "commitment_ids": committed,
    }
    (meter_dir / f"{agent}.json").write_text(json.dumps(payload, indent=2) + "\n")
    if not task:
        reason = "ambiguous_owned_acts_need_task_id" if not explicit else "no open task for agent"
        payload["ok"] = False
        payload["done"] = False
        payload["evidence"] = ev
        # meter must not claim delivered when refuse
        (meter_dir / f"{agent}.json").write_text(json.dumps(payload, indent=2) + "\n")
        print(
            json.dumps(
                {"applied": False, "reason": reason, **payload},
                indent=2,
            )
        )
        return 1
    # Final gate: picked task must match commitment when commitment names ids
    picked_id = str(task.get("id") or "")
    if committed and picked_id and picked_id not in committed:
        print(
            json.dumps(
                {
                    "ok": False,
                    "done": False,
                    "reason": "evidence_commitment_mismatch",
                    "task_id": picked_id,
                    "commitment_ids": committed,
                    "result": result[:240],
                },
                indent=2,
            )
        )
        return 2
    ops.apply_result(bus, task, out, by=agent)
    print(json.dumps({"applied": True, **payload}, indent=2))
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
