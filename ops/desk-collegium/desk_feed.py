#!/usr/bin/env python3
"""DESK feed — explainable collegium verbs + digest dedupe.

Display (Fog TUI): ``HH:MM:SS agent verb compact-tech-payload``
Prefer audit|act|revise|dispute|… over opaque ``say``.
Identical digests rate-limited (default 5 min) unless payload delta.
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

COLLEGIUM_KINDS = frozenset({
    "propose", "constrain", "act", "audit", "amend", "revise",
    "vote", "refer", "dispute", "commit", "escalate", "done", "drop",
    "call_vote", "cast",
})

# Opaque legacy → default Act (still technical; never invent fake progress)
SAY_ALIASES = {
    "say": "act",
    "chat": "act",
    "info": "act",
    "note": "act",
}

DEFAULT_DEDUPE_SEC = 300  # 5 minutes


def fog_home() -> Path:
    return Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))


def feed_path(fog: Path | None = None) -> Path:
    return (fog or fog_home()) / "data" / "desk-feed.jsonl"


def dedupe_path(fog: Path | None = None) -> Path:
    return (fog or fog_home()) / "data" / "desk-feed-dedupe.json"


def _now_parts() -> tuple[str, str]:
    return (
        time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        time.strftime("%H:%M:%S"),
    )


def normalize_kind(kind: str | None) -> str:
    k = (kind or "act").strip().lower().replace("-", "_")
    k = SAY_ALIASES.get(k, k)
    if k in COLLEGIUM_KINDS:
        return k
    # keep unknown short labels (soft) but prefer act
    return (k[:16] if k else "act")


def digest_key(agent: str, kind: str, text: str) -> str:
    """Stable key: agent|kind|normalized body (metrics kept so fog=0→1 is a delta)."""
    body = re.sub(r"\s+", " ", (text or "").strip().lower())
    body = body[:180]
    return f"{(agent or 'desk').lower()}|{normalize_kind(kind)}|{body}"


def load_dedupe(fog: Path | None = None) -> dict:
    p = dedupe_path(fog)
    if not p.is_file():
        return {"schema": "desk.feed_dedupe.v1", "entries": {}}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data.get("entries"), dict):
            data["entries"] = {}
        return data
    except Exception:
        return {"schema": "desk.feed_dedupe.v1", "entries": {}}


def save_dedupe(data: dict, fog: Path | None = None) -> None:
    p = dedupe_path(fog)
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        # prune old entries (>2h)
        now = time.time()
        entries = data.setdefault("entries", {})
        data["entries"] = {
            k: v for k, v in entries.items()
            if isinstance(v, (int, float)) and now - float(v) < 7200
        }
        p.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    except Exception:
        pass


def should_emit(
    agent: str,
    kind: str,
    text: str,
    *,
    fog: Path | None = None,
    dedupe_sec: int = DEFAULT_DEDUPE_SEC,
    force: bool = False,
) -> tuple[bool, str]:
    """Return (emit?, digest). force=True bypasses rate-limit."""
    dig = digest_key(agent, kind, text)
    if force or dedupe_sec <= 0:
        return True, dig
    data = load_dedupe(fog)
    last = float((data.get("entries") or {}).get(dig) or 0)
    now = time.time()
    if last and (now - last) < dedupe_sec:
        return False, dig
    return True, dig


def mark_emitted(digest: str, fog: Path | None = None) -> None:
    data = load_dedupe(fog)
    data.setdefault("entries", {})[digest] = time.time()
    save_dedupe(data, fog)


def format_line(agent: str, kind: str, text: str, *, t: str | None = None) -> str:
    """Human/TUI-facing one-liner (no JSON)."""
    tm = (t or time.strftime("%H:%M:%S"))[:8]
    ag = (agent or "desk")[:12]
    verb = normalize_kind(kind)
    body = re.sub(r"\s+", " ", (text or "").strip())[:200]
    return f"{tm} {ag} {verb} {body}".strip()


def append(
    agent: str,
    text: str,
    *,
    kind: str = "act",
    specialty: str = "",
    fog: Path | None = None,
    dedupe: bool = True,
    dedupe_sec: int = DEFAULT_DEDUPE_SEC,
    force: bool = False,
) -> dict:
    """Append one JSONL feed record. Returns {ok, deduped, rec?}."""
    fog = fog or fog_home()
    verb = normalize_kind(kind)
    body = (text or "")[:240]
    ag = (agent or "desk")[:32]
    emit, dig = should_emit(
        ag, verb, body, fog=fog, dedupe_sec=dedupe_sec if dedupe else 0, force=force,
    )
    if not emit:
        return {"ok": True, "deduped": True, "digest": dig}
    ts, t = _now_parts()
    rec = {
        "ts": ts,
        "t": t,
        "agent": ag,
        "kind": verb[:16],
        "specialty": (specialty or "")[:16],
        "text": body,
        "digest": dig[:80],
    }
    path = feed_path(fog)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()
        mark_emitted(dig, fog)
        return {"ok": True, "deduped": False, "rec": rec, "digest": dig}
    except Exception as e:
        return {"ok": False, "deduped": False, "err": str(e)[:120]}


# --- payload helpers (compact, technical) ---

def claw_payload(*, fog_public: int = 0, edge: int = 0, local8787: int = 0,
                 tokens_used: int = 0, tokens_limit: int = 33000,
                 extra: str = "") -> str:
    bits = [f"hops fog={int(fog_public)} edge={int(edge)} :8787={int(local8787)}"]
    if tokens_limit:
        bits.append(f"tokens {int(tokens_used)}/{int(tokens_limit)}")
    if extra:
        bits.append(extra.strip())
    return " | ".join(bits)


def surfaces_payload(*, ok: bool, parts: str = "TODO+CONTEXT+reports+journals") -> str:
    return f"surfaces {parts} {'ok' if ok else 'PARTIAL'}"


def actions_gh_miss_payload() -> str:
    return "actions: gh unavailable (PATH/auth)"


def protocol_payload(*, ok: bool, violations: list | None = None) -> str:
    if ok:
        return "protocol check ok"
    v = ",".join((violations or [])[:3]) or "unknown"
    return f"protocol VIOL {v}"
