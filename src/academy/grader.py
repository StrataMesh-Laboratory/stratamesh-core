"""Fail-closed symbolic grader. No model required. Never treats silence as pass."""

from __future__ import annotations

import re

from .catalog import COST, formation as get_formation

_TOXIC = (
    "workers.dev",
    "ghp_",
    "ghu_",
    "cfat_",
    "deo_live",
    "hf_xxxxxxxx",
)


def _norm(s: str) -> str:
    return " ".join((s or "").lower().replace("—", " ").replace("–", " ").split())


def _has(hay: str, needle: str) -> bool:
    n = _norm(needle)
    if not n:
        return False
    return re.search(r"(?<![a-z0-9])" + re.escape(n) + r"(?![a-z0-9])", hay) is not None


def grade_drill(drill: dict, answer: str) -> dict:
    text = _norm(answer)
    if not text:
        return {
            "pass": False,
            "unready": True,
            "reason": "empty answer — fail-closed",
            "missing": list(drill.get("must_contain") or []),
            "violations": [],
        }
    missing = [t for t in (drill.get("must_contain") or []) if not _has(text, t)]
    violations = [t for t in (drill.get("must_not_contain") or []) if t and _has(text, t)]
    toxic = [t for t in _TOXIC if t in text]
    ok = not missing and not violations and not toxic
    return {
        "pass": ok,
        "unready": (not ok) and bool(drill.get("fail_closed", True)),
        "missing": missing,
        "violations": violations + toxic,
        "reason": "pass" if ok else "fail-closed",
    }


def grade(formation_id: str, answers: list[str]) -> dict:
    f = get_formation(formation_id)
    if not f:
        return {"ok": False, "error": "unknown_formation", "formation_id": formation_id}
    drills = f["drills"]
    results = []
    for i, drill in enumerate(drills):
        ans = answers[i] if i < len(answers) else ""
        results.append({"i": i, "prompt": drill["prompt"], **grade_drill(drill, ans)})
    passed = sum(1 for r in results if r["pass"])
    unready = any(r.get("unready") for r in results)
    complete = passed == len(drills) and not unready
    return {
        "ok": True,
        "formation_id": f["id"],
        "role": f["role"],
        "mode": f["mode"],
        "title": f["title"],
        "passed": passed,
        "total": len(drills),
        "complete": complete,
        "unready": unready and not complete,
        "results": results,
        "cost": {
            "lab_waived": COST["lab_waived"],
            "strata": 0 if COST["lab_waived"] else COST["per_formation"],
            "rail": COST["rail"],
        },
    }
