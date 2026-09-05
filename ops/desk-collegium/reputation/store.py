#!/usr/bin/env python3
"""Qualitative peer-local reputation (v0).

Peer notes only — no numeric scores, no KPI / lab-progress / fund blend.
Self-notes are ignored. dispute/NACK never write here.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

# KPI wall: do not import desk_metrics, desk_ship, or lab-progress writers.

REPO_ROOT = Path(__file__).resolve().parents[3]
COLLEGIUM = Path(__file__).resolve().parents[1]
DEDUP_SEC = 300  # 5 min identical commend spam soft skip


def fog_home() -> Path:
    return Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))


def live_dir() -> Path:
    """Prefer live Mac Fog data; fall back to repo template dir."""
    fog = fog_home() / "data" / "desk-collegium" / "reputation"
    if os.environ.get("FOG_HOME") or fog_home().exists():
        return fog
    return COLLEGIUM / "reputation"


def aggregate_path() -> Path:
    return live_dir() / "reputation.json"


def shard_path(agent_id: str) -> Path:
    safe = (agent_id or "unknown").strip().lower().replace("@", "_")[:48]
    return live_dir() / f"{safe}.json"


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _now_epoch() -> float:
    return time.time()


def _short(agent: str) -> str:
    a = (agent or "").strip().lower()
    aliases = {
        "grok": "stratagrok",
        "grok@calhegasmorais.pt": "stratagrok",
        "hermes@fog.calhegasmorais.pt": "hermes",
        "opencode@fog.calhegasmorais.pt": "opencode",
        "openclaw@fog.calhegasmorais.pt": "openclaw",
        "cmn-fog-assistant": "fog-assistant",
        "cmn-edge-assistant": "edge-assistant",
        "fog": "fog-assistant",
        "edge": "edge-assistant",
    }
    if a in aliases:
        return aliases[a]
    if "@" in a:
        local = a.split("@", 1)[0]
        if local == "grok":
            return "stratagrok"
        return local[:32]
    return a[:32] or "desk"


def empty_store() -> dict:
    return {
        "schema": "desk.reputation.v0",
        "version": "0.1.0",
        "updated": None,
        "notes": [],
    }


def load_store() -> dict:
    p = aggregate_path()
    tmpl = COLLEGIUM / "reputation" / "reputation.json"
    if p.is_file():
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data.get("notes"), list):
                return data
        except Exception:
            pass
    if tmpl.is_file():
        try:
            data = json.loads(tmpl.read_text(encoding="utf-8"))
            if isinstance(data.get("notes"), list):
                return data
        except Exception:
            pass
    return empty_store()


def save_store(data: dict) -> Path:
    data = dict(data)
    data["schema"] = "desk.reputation.v0"
    data["updated"] = _now()
    notes = data.get("notes") or []
    if not isinstance(notes, list):
        notes = []
    data["notes"] = notes
    path = aggregate_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")
    # best-effort mirror into repo template dir when operating on FOG live
    try:
        repo_p = COLLEGIUM / "reputation" / "reputation.json"
        if path.resolve() != repo_p.resolve():
            # never overwrite repo with live notes that may be noisy — keep repo notes empty template
            pass
    except Exception:
        pass
    _sync_shards(notes)
    return path


def _sync_shards(notes: list) -> None:
    by_to: dict[str, list] = {}
    for n in notes:
        if not isinstance(n, dict):
            continue
        to = _short(str(n.get("to") or ""))
        if not to:
            continue
        by_to.setdefault(to, []).append(n)
    known = {
        "stratagrok",
        "hermes",
        "opencode",
        "openclaw",
        "fog-assistant",
        "edge-assistant",
    }
    for agent in known | set(by_to):
        shard = {
            "schema": "desk.reputation.shard.v0",
            "agent": agent,
            "notes": by_to.get(agent, []),
        }
        sp = shard_path(agent)
        try:
            sp.parent.mkdir(parents=True, exist_ok=True)
            sp.write_text(json.dumps(shard, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        except Exception:
            pass


def _norm_tags(tags: list | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for t in tags or []:
        s = str(t).strip().lower()[:64]
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out[:16]


def _norm_qual(items: list | None) -> list[str]:
    out: list[str] = []
    for q in items or []:
        s = str(q).strip()[:240]
        if s:
            out.append(s)
    return out[:8]


def write_note(
    *,
    frm: str,
    to: str,
    skill_tags: list | None = None,
    qualitative: list | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Append or refresh a from→to qualitative note. Self-notes ignored."""
    src = _short(frm)
    dst = _short(to)
    if not src or not dst:
        return {"ok": False, "skipped": "missing_from_or_to"}
    if src == dst:
        return {"ok": True, "skipped": "self", "from": src, "to": dst}
    tags = _norm_tags(skill_tags)
    quals = _norm_qual(qualitative)
    if not tags and not quals:
        return {"ok": False, "skipped": "empty_note"}
    store = load_store()
    notes: list = list(store.get("notes") or [])
    now = _now()
    # soft dedupe identical commend within DEDUP_SEC
    if not force:
        cutoff = _now_epoch() - DEDUP_SEC
        for n in reversed(notes):
            if not isinstance(n, dict):
                continue
            if _short(str(n.get("from") or "")) != src:
                continue
            if _short(str(n.get("to") or "")) != dst:
                continue
            if _norm_tags(n.get("skill_tags")) != tags:
                continue
            if _norm_qual(n.get("qualitative")) != quals:
                continue
            ep = _parse_updated_epoch(str(n.get("updated") or ""))
            if ep and ep >= cutoff:
                return {
                    "ok": True,
                    "skipped": "duplicate",
                    "from": src,
                    "to": dst,
                    "note": n,
                }
            break
    # upsert same from→to: merge tags/qualitative, refresh updated
    merged = False
    note = {
        "from": src,
        "to": dst,
        "skill_tags": tags,
        "qualitative": quals,
        "updated": now,
    }
    for i, n in enumerate(notes):
        if not isinstance(n, dict):
            continue
        if _short(str(n.get("from") or "")) == src and _short(str(n.get("to") or "")) == dst:
            old_tags = _norm_tags(n.get("skill_tags"))
            old_q = _norm_qual(n.get("qualitative"))
            merged_tags = _norm_tags(old_tags + tags)
            merged_q = _norm_qual(old_q + [q for q in quals if q not in old_q])
            note = {
                "from": src,
                "to": dst,
                "skill_tags": merged_tags,
                "qualitative": merged_q,
                "updated": now,
            }
            notes[i] = note
            merged = True
            break
    if not merged:
        notes.append(note)
    # cap store size
    if len(notes) > 500:
        notes = notes[-500:]
    store["notes"] = notes
    path = save_store(store)
    return {"ok": True, "merged": merged, "note": note, "path": str(path)}


def commend(
    *,
    frm: str,
    to: str,
    skill_tags: list | None = None,
    qualitative: list | None = None,
    note: str = "",
) -> dict[str, Any]:
    """Peer commend → reputation write + caller should append feed."""
    quals = list(qualitative or [])
    if note and note.strip():
        quals = _norm_qual(quals + [note.strip()])
    return write_note(frm=frm, to=to, skill_tags=skill_tags, qualitative=quals)


def ask_help(
    *,
    frm: str,
    to: str = "",
    skill_tags: list | None = None,
    note: str = "",
) -> dict[str, Any]:
    """ask_help does not invent self-reputation; optional target for soft seek."""
    src = _short(frm)
    dst = _short(to) if to else ""
    tags = _norm_tags(skill_tags)
    # asking help never writes a self note; only records seek metadata for caller/feed
    out: dict[str, Any] = {
        "ok": True,
        "verb": "ask_help",
        "from": src,
        "to": dst or None,
        "skill_tags": tags,
        "note": (note or "")[:240],
        "wrote_reputation": False,
    }
    # If explicitly thanking a named helper mid-ask, still ignore self
    if dst and dst != src and (tags or note):
        # do not auto-commend on ask — only return ranking hint
        out["wrote_reputation"] = False
    return out


def load_roles(path: Path | None = None) -> dict:
    p = path or (COLLEGIUM / "agent_roles.json")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"members": []}


def _member_map(roles: dict | None = None) -> dict[str, dict]:
    roles = roles or load_roles()
    out: dict[str, dict] = {}
    for m in roles.get("members") or []:
        mid = _short(str(m.get("id") or ""))
        if mid:
            out[mid] = m
    return out


def _parse_updated_epoch(updated: str | None) -> float:
    if not updated:
        return 0.0
    s = str(updated).strip()
    if s.endswith("Z"):
        s = s[:-1] + "+0000"
    # +01:00 → +0100
    if len(s) >= 6 and (s[-6] in "+-") and s[-3] == ":":
        s = s[:-3] + s[-2:]
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            return time.mktime(time.strptime(s, fmt))
        except Exception:
            continue
    return 0.0


def rank_helpers(
    *,
    task_tags: list | None = None,
    specialty: str = "",
    candidates: list[str] | None = None,
    roles: dict | None = None,
    store: dict | None = None,
) -> list[dict[str, Any]]:
    """Soft prior: specialty → will_help∩tags → recent qualitative → else RR order.

    Never starves: all candidates returned; only ordering changes.
    No numeric KPI blend.
    """
    tags = set(_norm_tags(task_tags))
    spec = (specialty or "").strip().lower()
    members = _member_map(roles)
    if candidates is None:
        candidates = list(members.keys())
    else:
        candidates = [_short(c) for c in candidates if c]
    # stable RR baseline order (roster order)
    baseline = {c: i for i, c in enumerate(candidates)}
    notes = (store or load_store()).get("notes") or []
    now = _now_epoch()
    ranked: list[dict[str, Any]] = []
    for cand in candidates:
        m = members.get(cand) or {}
        cand_spec = str(m.get("specialty") or "").lower()
        will = set(_norm_tags(m.get("will_help")))
        skills = set(_norm_tags(m.get("skills")))
        # tier 0: specialty match
        specialty_hit = 1 if spec and cand_spec == spec else 0
        # tier 1: will_help ∩ tags (or skills ∩ tags as weak)
        help_hit = len(will & tags)
        skill_hit = len(skills & tags)
        # tier 2: recent qualitative notes about cand (recency only — count freshness, not KPI)
        recency = 0.0
        tag_echo = 0
        for n in notes:
            if not isinstance(n, dict):
                continue
            if _short(str(n.get("to") or "")) != cand:
                continue
            # ignore self-shaped if any slipped through
            if _short(str(n.get("from") or "")) == cand:
                continue
            ep = _parse_updated_epoch(str(n.get("updated") or ""))
            age_h = max(0.0, (now - ep) / 3600.0) if ep else 72.0
            # fresher → higher soft weight (halflife ~48h), capped
            soft = 1.0 / (1.0 + age_h / 48.0)
            recency += soft
            ntags = set(_norm_tags(n.get("skill_tags")))
            tag_echo += len(ntags & tags)
        # sort key: higher better for specialty/help/recency; RR index as last resort (lower better)
        # We negate RR so sort is uniformly descending.
        key = (
            specialty_hit,
            help_hit,
            skill_hit,
            tag_echo,
            round(recency, 4),
            -baseline.get(cand, 99),
        )
        ranked.append(
            {
                "id": cand,
                "specialty": cand_spec,
                "key": key,
                "soft": {
                    "specialty_match": bool(specialty_hit),
                    "will_help_hits": help_hit,
                    "skill_hits": skill_hit,
                    "note_tag_echo": tag_echo,
                    "recency_soft": round(recency, 4),
                    "rr_index": baseline.get(cand, 99),
                },
            }
        )
    ranked.sort(key=lambda r: r["key"], reverse=True)
    return ranked


def soft_prior_score_for_specialty(
    specialty: str,
    *,
    task_tags: list | None = None,
    roles: dict | None = None,
    store: dict | None = None,
) -> float:
    """Tiny soft boost for pick_tasks secondary key — never a hard gate.

    Returns 0.0..1.0-ish qualitative fit for the specialty lane (best helper).
    """
    ranked = rank_helpers(
        task_tags=task_tags,
        specialty=specialty,
        roles=roles,
        store=store,
    )
    if not ranked:
        return 0.0
    top = ranked[0]["soft"]
    # bounded soft — specialty match dominates lightly
    score = 0.0
    if top.get("specialty_match"):
        score += 0.5
    score += min(0.3, 0.1 * int(top.get("will_help_hits") or 0))
    score += min(0.15, 0.05 * int(top.get("note_tag_echo") or 0))
    score += min(0.05, 0.02 * float(top.get("recency_soft") or 0.0))
    return round(min(1.0, score), 4)


__all__ = [
    "ask_help",
    "commend",
    "load_store",
    "rank_helpers",
    "save_store",
    "soft_prior_score_for_specialty",
    "write_note",
]
