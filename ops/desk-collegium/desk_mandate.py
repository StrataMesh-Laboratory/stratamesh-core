#!/usr/bin/env python3
"""Agent direction: mandate (standing) + commitment (live).

Subjects on the desk are directed iff mandate ∧ commitment ∧ evidence_gate.
See AGENT-DIRECTION.md.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
MANDATE_DIR = HERE / "mandates"


def fog_home() -> Path:
    return Path(os.environ.get("FOG_HOME") or str(Path.home() / "StrataMesh" / "fog"))


def live_dir() -> Path:
    d = fog_home() / "data" / "desk-mandates" / "live"
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_mandate(agent_id: str) -> dict[str, Any]:
    p = MANDATE_DIR / f"{agent_id}.json"
    if not p.is_file():
        aliases = {
            "coord": "hermes",
            "claw": "openclaw",
            "code": "opencode",
            "lead": "stratagrok",
            "fog": "fog-assistant",
            "edge": "edge-assistant",
        }
        aid = aliases.get(agent_id, agent_id)
        p = MANDATE_DIR / f"{aid}.json"
    if not p.is_file():
        return {
            "schema": "desk.mandate.v1",
            "id": agent_id,
            "purpose": f"Desk subject {agent_id}: do the bound commitment with evidence.",
            "default_done_when": ["non-empty evidence path in result"],
            "default_stop_when": ["standing_refer"],
            "not_this": ["fake done", "audit-as-Act"],
        }
    return json.loads(p.read_text(encoding="utf-8"))


def commitment_path(agent_id: str) -> Path:
    return live_dir() / f"{agent_id}.json"


def load_commitment(agent_id: str) -> dict[str, Any] | None:
    p = commitment_path(agent_id)
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def clear_commitment(agent_id: str) -> None:
    p = commitment_path(agent_id)
    if p.is_file():
        p.unlink()


def bind_commitment(
    agent_id: str,
    task: dict[str, Any],
    *,
    purpose_one_liner: str | None = None,
) -> dict[str, Any]:
    """Bind exactly one live commitment for this subject from a bus task."""
    mandate = load_mandate(agent_id)
    tid = str(task.get("id") or "")
    intent = (task.get("intent") or task.get("title") or "").strip()
    purpose = (purpose_one_liner or intent or f"Advance {tid}").strip()[:240]
    done_when = list(task.get("done_when") or mandate.get("default_done_when") or [])
    stop_when = list(task.get("stop_when") or mandate.get("default_stop_when") or [])
    not_this = list(mandate.get("not_this") or [])
    if task.get("not_this"):
        not_this = list(task.get("not_this")) + not_this
    c = {
        "schema": "desk.commitment.v1",
        "agent_id": mandate.get("id") or agent_id,
        "task_id": tid,
        "specialty": mandate.get("specialty") or task.get("specialty") or "",
        "purpose_one_liner": purpose,
        "mandate_purpose": mandate.get("purpose") or "",
        "done_when": done_when,
        "stop_when": stop_when,
        "not_this": not_this,
        "bound_from": "desk_ops.bind_commitment",
    }
    commitment_path(agent_id).write_text(json.dumps(c, indent=2) + "\n", encoding="utf-8")
    return c


def render_directed_brief(commitment: dict[str, Any], *, annex: str = "") -> str:
    """Brief for oneshot: purpose-first, no filing-cabinet dump."""
    lines = [
        f"# Directed Act — {commitment.get('agent_id')} — {commitment.get('task_id')}",
        "",
        "## Who you are (mandate)",
        str(commitment.get("mandate_purpose") or "").strip(),
        "",
        "## What you are doing now (commitment)",
        str(commitment.get("purpose_one_liner") or "").strip(),
        "",
        "## Done only when (evidence)",
    ]
    for x in commitment.get("done_when") or []:
        lines.append(f"- {x}")
    lines += ["", "## Stop if"]
    for x in commitment.get("stop_when") or []:
        lines.append(f"- {x}")
    lines += ["", "## Never"]
    for x in commitment.get("not_this") or []:
        lines.append(f"- {x}")
    lines += [
        "",
        "## Rules",
        "- Do real work toward Done. Cite paths, commands, exit codes.",
        "- If Stop applies: say so and stop. Do not invent progress.",
        "- No fake done. Skip/queue/audit is not Done.",
        "",
    ]
    if annex.strip():
        lines += [
            "## Annex (secondary — do not replace commitment)",
            annex.strip()[:1200],
            "",
        ]
    return "\n".join(lines)


def evidence_matches_commitment(blob: str, commitment: dict[str, Any]) -> bool:
    """Heuristic: at least one done_when needle appears in evidence blob, or a path write."""
    text = (blob or "").lower()
    if not text.strip():
        return False
    if "no inference provider" in text:
        return False
    if "help" in text[:400] and "opencode" in text and "wrote" not in text:
        return False
    hits = 0
    for rule in commitment.get("done_when") or []:
        for tok in re.findall(r"[a-z0-9_./-]{4,}", str(rule).lower()):
            if tok in (
                "when", "with", "this", "that", "from", "only",
                "true", "false", "file", "path", "non-empty",
            ):
                continue
            if tok in text:
                hits += 1
                break
    if hits >= 1:
        return True
    if re.search(r"(wrote|created|diff|sha=|rc=0|fog=1|evidence)", text):
        return True
    return False


def agent_for_handler(handler: str) -> str:
    return {
        "coord": "hermes",
        "claw": "openclaw",
        "code": "opencode",
        "lead": "stratagrok",
        "fog": "fog-assistant",
        "edge": "edge-assistant",
        "teach": "hermes",
    }.get(handler, handler)
