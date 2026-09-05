#!/usr/bin/env python3
"""Private inter-agent consult threads (v0).

Chat bodies stay off the public DESK feed. KPI wall: no desk_metrics / lab-progress.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

COLLEGIUM = Path(__file__).resolve().parents[1]


def fog_home() -> Path:
    return Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))


def live_dir() -> Path:
    fog = fog_home() / "data" / "desk-collegium" / "consult"
    if os.environ.get("FOG_HOME") or fog_home().exists():
        return fog
    return COLLEGIUM / "consult"


def index_path() -> Path:
    return live_dir() / "index.json"


def threads_dir() -> Path:
    return live_dir() / "threads"


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


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
        return "stratagrok" if local == "grok" else local[:32]
    return a[:32] or "desk"


def empty_index() -> dict:
    return {
        "schema": "desk.consult.index.v0",
        "version": "0.1.0",
        "updated": None,
        "threads": {},
    }


def load_index() -> dict:
    p = index_path()
    tmpl = COLLEGIUM / "consult" / "index.json"
    for cand in (p, tmpl):
        if cand.is_file():
            try:
                data = json.loads(cand.read_text(encoding="utf-8"))
                if isinstance(data.get("threads"), dict):
                    return data
            except Exception:
                pass
    return empty_index()


def save_index(data: dict) -> Path:
    data = dict(data)
    data["schema"] = "desk.consult.index.v0"
    data["updated"] = _now()
    if not isinstance(data.get("threads"), dict):
        data["threads"] = {}
    path = index_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    threads_dir().mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def _thread_path(thread_id: str) -> Path:
    safe = "".join(c for c in thread_id if c.isalnum() or c in "-_")[:64]
    return threads_dir() / f"{safe}.jsonl"


def _new_id() -> str:
    return f"ct-{uuid.uuid4().hex[:10]}"


def open_thread(
    *,
    frm: str,
    to: list[str] | str,
    topic: str = "",
    text: str = "",
    related_task: str = "",
) -> dict[str, Any]:
    """Open a private consult thread; optional first message."""
    src = _short(frm)
    if isinstance(to, str):
        peers = [_short(x) for x in to.replace(",", " ").split() if x.strip()]
    else:
        peers = [_short(x) for x in (to or []) if x]
    peers = [p for p in peers if p and p != src]
    if not peers:
        return {"ok": False, "err": "consult open requires --to peer(s)"}
    participants = sorted(set([src] + peers))
    tid = _new_id()
    now = _now()
    meta = {
        "id": tid,
        "participants": participants,
        "topic": (topic or text or "consult")[:160],
        "status": "open",
        "created": now,
        "updated": now,
        "created_by": src,
        "related_task": (related_task or "")[:64],
        "msg_count": 0,
    }
    idx = load_index()
    idx.setdefault("threads", {})[tid] = meta
    save_index(idx)
    out: dict[str, Any] = {"ok": True, "thread": meta, "opened": True}
    if text and text.strip():
        msg = reply(thread_id=tid, frm=src, text=text.strip())
        out["first"] = msg
        out["thread"] = load_index()["threads"].get(tid, meta)
    return out


def _participant_ok(meta: dict, agent: str) -> bool:
    return _short(agent) in [ _short(x) for x in (meta.get("participants") or []) ]


def reply(*, thread_id: str, frm: str, text: str) -> dict[str, Any]:
    """Append a private message; only participants may write."""
    tid = (thread_id or "").strip()
    src = _short(frm)
    body = (text or "").strip()
    if not tid or not body:
        return {"ok": False, "err": "thread_id and text required"}
    idx = load_index()
    meta = (idx.get("threads") or {}).get(tid)
    if not meta:
        return {"ok": False, "err": f"unknown thread {tid}"}
    if meta.get("status") == "closed":
        return {"ok": False, "err": f"thread {tid} closed"}
    if not _participant_ok(meta, src):
        return {"ok": False, "err": f"{src} not a participant of {tid}"}
    seq = int(meta.get("msg_count") or 0) + 1
    rec = {"ts": _now(), "from": src, "text": body[:2000], "seq": seq}
    path = _thread_path(tid)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    meta = dict(meta)
    meta["msg_count"] = seq
    meta["updated"] = rec["ts"]
    idx["threads"][tid] = meta
    save_index(idx)
    return {"ok": True, "thread_id": tid, "message": rec, "meta": meta}


def close_thread(*, thread_id: str, frm: str, note: str = "") -> dict[str, Any]:
    tid = (thread_id or "").strip()
    src = _short(frm)
    idx = load_index()
    meta = (idx.get("threads") or {}).get(tid)
    if not meta:
        return {"ok": False, "err": f"unknown thread {tid}"}
    if not _participant_ok(meta, src):
        return {"ok": False, "err": f"{src} not a participant of {tid}"}
    meta = dict(meta)
    meta["status"] = "closed"
    meta["updated"] = _now()
    meta["closed_by"] = src
    if note:
        meta["close_note"] = note[:240]
    idx["threads"][tid] = meta
    save_index(idx)
    return {"ok": True, "thread": meta}


def list_threads(*, for_agent: str = "", status: str = "open") -> list[dict]:
    idx = load_index()
    agent = _short(for_agent) if for_agent else ""
    out: list[dict] = []
    for meta in (idx.get("threads") or {}).values():
        if not isinstance(meta, dict):
            continue
        if status and meta.get("status") != status and status != "all":
            continue
        if agent and not _participant_ok(meta, agent):
            continue
        out.append(meta)
    out.sort(key=lambda m: m.get("updated") or "", reverse=True)
    return out


def read_thread(*, thread_id: str, frm: str = "", limit: int = 100) -> dict[str, Any]:
    """Read messages; if frm set, require participant."""
    tid = (thread_id or "").strip()
    idx = load_index()
    meta = (idx.get("threads") or {}).get(tid)
    if not meta:
        return {"ok": False, "err": f"unknown thread {tid}"}
    if frm and not _participant_ok(meta, frm):
        return {"ok": False, "err": f"{_short(frm)} not a participant of {tid}"}
    path = _thread_path(tid)
    msgs: list[dict] = []
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                msgs.append(json.loads(line))
            except Exception:
                continue
    if limit and len(msgs) > limit:
        msgs = msgs[-limit:]
    return {"ok": True, "thread": meta, "messages": msgs}


def opaque_feed_pointer(*, verb: str, thread_id: str, participants: list[str] | None = None) -> str:
    """Public feed must never include chat body — only opaque pointer."""
    parts = ",".join(participants or [])
    if verb == "open":
        return f"consult open {thread_id}" + (f" ↔ {parts}" if parts else "")
    if verb == "close":
        return f"consult_close {thread_id}"
    return f"consult reply {thread_id}"


__all__ = [
    "close_thread",
    "list_threads",
    "opaque_feed_pointer",
    "open_thread",
    "read_thread",
    "reply",
]
