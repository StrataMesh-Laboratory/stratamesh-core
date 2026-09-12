"""Refresh Pending from roadmap → telos thresholds (André 2026-09-12).

Pending must ALWAYS be re-derived from documented milestone thresholds,
not only leftover open items. Idempotent. Never invents PASS / done.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
THRESHOLDS_PATH = HERE / "roadmap_thresholds.json"
VISION = REPO_ROOT / "docs" / "ROADMAP-VISION.md"

MILESTONE_RE = re.compile(
    r"^Milestone\s+([IVX]+)\s+[—–-]\s+(.+)$",
    re.MULTILINE,
)


def load_roadmap_thresholds(path: Path | None = None) -> dict:
    """Load thin catalog, or parse ROADMAP-VISION headings if the file is missing."""
    p = path or THRESHOLDS_PATH
    if p.is_file():
        data = json.loads(p.read_text(encoding="utf-8"))
        if data.get("thresholds"):
            return data
    return fallback_thresholds_from_docs()


def fallback_thresholds_from_docs(vision: Path | None = None) -> dict:
    """Parse Milestone I–IX from ROADMAP-VISION.md. No vapour titles."""
    src = vision or VISION
    thresholds: list[dict] = []
    if src.is_file():
        text = src.read_text(encoding="utf-8")
        for m in MILESTONE_RE.finditer(text):
            roman, title = m.group(1), m.group(2).strip()
            slug = {
                "I": "m1-lab-protocol",
                "II": "m2-twohost",
                "III": "m3-fog-appliance",
                "IV": "m4-resilient-infra",
                "V": "m5-public-testnet",
                "VI": "m6-metaversal-os",
                "VII": "m7-terminalization",
                "VIII": "m8-global-fabric",
                "IX": "m9-mature-mainnet",
            }.get(roman)
            if not slug:
                continue
            eh = "act" if roman in ("I", "II") else "plan"
            spec = "lead" if roman in ("II", "V", "VIII", "IX") else "coord"
            if roman in ("III", "IV"):
                spec = "fog"
            thresholds.append({
                "id": f"rm-{slug}",
                "milestone": f"M-{roman}",
                "title": title,
                "eisenhower": eh,
                "specialty": spec,
                "owner": "hermes",
                "intent": (
                    f"M-{roman} {title} — next unmet from ROADMAP-VISION §23. "
                    "Not claimed PASS."
                ),
                "source_doc": "docs/ROADMAP-VISION.md",
            })
    return {
        "schema": "desk.roadmap_thresholds.v1",
        "spine": "docs/ROADMAP-VISION.md",
        "telos": "M-IX Mature Mainnet loop (ROADMAP-VISION §23)",
        "note": "fallback parsed from ROADMAP-VISION.md — catalog file missing",
        "thresholds": thresholds,
        "fallback": True,
    }


def roadmap_task_id(threshold_id: str) -> str:
    raw = (threshold_id or "x").replace("_", "-")
    if raw.startswith("rm-"):
        raw = raw[3:]
    slug = "".join(c if c.isalnum() or c == "-" else "-" for c in raw)[:40]
    return f"dt-rm-{slug}"


def _ids_and_sources(state: dict) -> tuple[set[str], set[str]]:
    open_t = list(state.get("open_tasks") or [])
    done_t = list(state.get("done_tasks") or [])
    ids = {t.get("id") for t in open_t + done_t if t.get("id")}
    sources = {t.get("source") for t in open_t + done_t if t.get("source")}
    return ids, sources


def threshold_already_tracked(state: dict, item: dict) -> bool:
    """True if this threshold (or an alias) is already open or done."""
    tid = roadmap_task_id(item.get("id") or "")
    src = f"roadmap:{item.get('id')}"
    ids, sources = _ids_and_sources(state)
    if tid in ids or src in sources or item.get("id") in ids:
        return True
    for alias in item.get("aliases") or []:
        if not alias:
            continue
        if alias in ids or f"projected:{alias}" in sources or f"roadmap:{alias}" in sources:
            return True
        # projected catalog ids map to dt-proj-<slug>
        if str(alias).startswith("proj-"):
            mapped = "dt-proj-" + str(alias)[5:]
            if mapped in ids:
                return True
    return False


def unmet_thresholds(state: dict, data: dict | None = None, *, limit: int = 16) -> list[dict]:
    """Next unmet documented thresholds (not open, not done, never auto-PASS)."""
    data = data if data is not None else load_roadmap_thresholds()
    out: list[dict] = []
    for item in data.get("thresholds") or []:
        if item.get("met") is True:
            # catalog may record historical close — still never invent PASS here
            continue
        if threshold_already_tracked(state, item):
            continue
        out.append(dict(item))
        if len(out) >= limit:
            break
    return out


def _seed_one(bus, item: dict, *, dry: bool, eisenhower: str) -> str | None:
    pid = item.get("id")
    if not pid:
        return None
    tid = roadmap_task_id(pid)
    state = bus.load_state()
    if bus.find_task(state, tid):
        return None
    src = f"roadmap:{pid}"
    for t in (state.get("open_tasks") or []) + (state.get("done_tasks") or []):
        if t.get("source") == src:
            return None
    if dry:
        return f"would seed {pid} → {tid}"
    spec = item.get("specialty") or "coord"
    ns = argparse.Namespace(
        owner=item.get("owner") or "hermes",
        specialty=spec,
        intent=item.get("intent") or pid,
        id=tid,
        lanes=item.get("lanes") or [],
    )
    rc = bus.cmd_propose(ns)
    if rc != 0:
        return None
    state = bus.load_state()
    task = bus.find_task(state, tid)
    if task:
        task["source"] = src
        task["eisenhower"] = eisenhower
        task["roadmap_milestone"] = item.get("milestone")
        task["roadmap_doc"] = item.get("source_doc") or "docs/ROADMAP-VISION.md"
        if item.get("title"):
            task["title"] = item["title"]
        # never mark done / PASS from refresh
        if task.get("status") == "done":
            task["status"] = "propose"
        bus.save_state(state)
    return tid


def refresh_roadmap_pending(bus, state: dict, *, dry: bool = False, limit: int = 16) -> list[str]:
    """Seed next unmet roadmap→telos thresholds as propose (Pending).

    First newly seeded item keeps catalog eisenhower (usually act = next Act).
    Remaining new items are forced to plan so they stay in Pending (not
    auto-constrained by cycle pick). Idempotent. Never sets done/PASS.
    """
    data = load_roadmap_thresholds()
    seeded: list[str] = []
    unmet = unmet_thresholds(state, data, limit=limit)
    for i, item in enumerate(unmet):
        eh = (item.get("eisenhower") or "plan").lower()
        if i > 0:
            eh = "plan"
        got = _seed_one(bus, item, dry=dry, eisenhower=eh)
        if got:
            seeded.append(got if not str(got).startswith("would") else got)
            if not dry:
                state = bus.load_state()
    return seeded
