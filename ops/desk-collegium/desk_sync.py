#!/usr/bin/env python3
"""Bidirectional sync with https://api-edge.calhegasmorais.pt/desk

Live pull+push on Fog TUI r / auto-r (60s instrument). g / auto-g is upgrades only.
Bearer DESK_TOKEN from automation-desk vault files only — never git, never chat.

Merge rule (never compromise ongoing tasks):
  Local open_tasks in status constrain|revise|commit are protected.
  Remote cannot drop or overwrite them. Remote may add new propose ids.
  Mail digest + member paces + feed_tail append are always safe to refresh.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_URL = os.environ.get("DESK_URL") or "https://api-edge.calhegasmorais.pt/desk"
FOG = Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))
REPO_ROOT = Path(__file__).resolve().parents[2]
PROTECTED = frozenset({"constrain", "revise", "commit"})

TOKEN_CANDIDATES = [
    Path.home() / ".config/stratagrok/desk-mail.token",
    Path.home() / ".config/stratamesh/desk-mail.token",
    Path.home() / ".config/stratamesh/DESK_TOKEN",
    FOG / "data/secrets/desk-mail.token",
    Path.home() / ".config/stratagrok/secrets.env",
]


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def load_desk_token() -> str:
    env = (os.environ.get("DESK_TOKEN") or "").strip()
    if env:
        return env
    for path in TOKEN_CANDIDATES:
        try:
            if not path.is_file():
                continue
            raw = path.read_text(encoding="utf-8")
            if path.name == "secrets.env":
                for line in raw.splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if line.startswith("DESK_TOKEN="):
                        val = line.split("=", 1)[1].strip().strip("'\"")
                        if val:
                            return val
            else:
                val = raw.strip().splitlines()[0].strip() if raw.strip() else ""
                if val and not val.startswith("#"):
                    return val
        except Exception:
            continue
    return ""


def _state_paths() -> tuple[Path, Path]:
    fog_p = FOG / "data/desk-collegium/state.json"
    repo_p = REPO_ROOT / "ops/desk-collegium/state.json"
    return fog_p, repo_p


def load_local_state() -> dict:
    fog_p, repo_p = _state_paths()
    for p in (fog_p, repo_p):
        if p.is_file():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                continue
    return {"schema": "desk.collegium.state.v1", "open_tasks": [], "members": []}


def save_local_state(state: dict) -> Path:
    fog_p, repo_p = _state_paths()
    fog_p.parent.mkdir(parents=True, exist_ok=True)
    state["updated"] = _now()
    text = json.dumps(state, indent=2, ensure_ascii=False) + "\n"
    fog_p.write_text(text, encoding="utf-8")
    try:
        repo_p.write_text(text, encoding="utf-8")
    except Exception:
        pass
    return fog_p


def feed_path() -> Path:
    return FOG / "data/desk-feed.jsonl"


def feed_tail_local(n: int = 30) -> list[dict]:
    path = feed_path()
    if not path.is_file():
        return []
    try:
        data = path.read_bytes()
        if len(data) > 200_000:
            data = data[-200_000:]
        out = []
        for line in data.decode("utf-8", "replace").splitlines()[-n:]:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            if isinstance(rec, dict) and rec.get("text"):
                out.append({
                    "t": str(rec.get("t") or "")[:8],
                    "agent": str(rec.get("agent") or "")[:32],
                    "kind": str(rec.get("kind") or "")[:16],
                    "specialty": str(rec.get("specialty") or "")[:16],
                    "text": str(rec.get("text") or "")[:240],
                })
        return out
    except Exception:
        return []


def append_feed_lines(rows: list[dict]) -> int:
    if not rows:
        return 0
    path = feed_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = set()
    if path.is_file():
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines()[-200:]:
            existing.add(line.strip())
    n = 0
    with path.open("a", encoding="utf-8") as f:
        for rec in rows:
            if not isinstance(rec, dict) or not rec.get("text"):
                continue
            clean = {
                "ts": str(rec.get("ts") or _now())[:40],
                "t": str(rec.get("t") or time.strftime("%H:%M:%S"))[:8],
                "agent": str(rec.get("agent") or "edge")[:32],
                "kind": str(rec.get("kind") or "say")[:16],
                "specialty": str(rec.get("specialty") or "")[:16],
                "text": str(rec.get("text") or "")[:240],
            }
            line = json.dumps(clean, ensure_ascii=False)
            if line in existing:
                continue
            f.write(line + "\n")
            existing.add(line)
            n += 1
    return n


def sanitize_collegium(state: dict) -> dict:
    """Strip anything that must never leave the Mac vault/desk."""
    tasks = []
    for t in state.get("open_tasks") or []:
        if not isinstance(t, dict):
            continue
        tasks.append({
            "schema": "desk.task.v1",
            "id": str(t.get("id") or "")[:40],
            "owner": str(t.get("owner") or "")[:80],
            "specialty": str(t.get("specialty") or "")[:16],
            "intent": str(t.get("intent") or "")[:200],
            "status": str(t.get("status") or "propose")[:16],
            "lanes": [str(x)[:32] for x in (t.get("lanes") or [])][:8],
            "constraints": [str(x)[:120] for x in (t.get("constraints") or [])][-8:],
            "result": str(t.get("result") or "")[:200],
            "sha": str(t.get("sha") or "")[:40],
            "updated": str(t.get("updated") or "")[:40],
        })
    members = []
    for m in state.get("members") or []:
        if not isinstance(m, dict):
            continue
        members.append({
            "id": str(m.get("id") or "")[:80],
            "role": str(m.get("role") or "")[:40],
            "lane": str(m.get("lane") or "")[:40],
            "pace": str(m.get("pace") or "ALLOW")[:16],
            "specialty": str(m.get("specialty") or "")[:16],
        })
    lc = state.get("last_commit")
    last = None
    if isinstance(lc, dict):
        last = {
            "id": str(lc.get("id") or "")[:40],
            "sha": str(lc.get("sha") or "")[:40],
            "result": str(lc.get("result") or "")[:200],
            "at": str(lc.get("at") or "")[:40],
            "owner": str(lc.get("owner") or "")[:80],
        }
    return {
        "schema": "desk.collegium.state.v1",
        "version": str(state.get("version") or "")[:32],
        "updated": str(state.get("updated") or _now())[:40],
        "members": members,
        "open_tasks": tasks,
        "last_commit": last,
        "bus": str(state.get("bus") or "propose→constrain→revise→commit|escalate")[:80],
    }


def merge_collegium(local: dict, remote: dict) -> tuple[dict, list[str]]:
    """Merge remote into local without compromising protected local tasks."""
    notes: list[str] = []
    if not isinstance(remote, dict):
        return local, ["no remote collegium"]
    out = dict(local)
    # paces / members from remote (non-destructive)
    if remote.get("members"):
        by_id = {m.get("id"): m for m in (out.get("members") or []) if isinstance(m, dict)}
        for rm in remote["members"]:
            if not isinstance(rm, dict) or not rm.get("id"):
                continue
            lid = rm["id"]
            if lid in by_id:
                # update pace only
                if rm.get("pace"):
                    by_id[lid]["pace"] = rm["pace"]
            else:
                by_id[lid] = rm
        out["members"] = list(by_id.values())
        notes.append("members/paces refreshed")
    local_tasks = {t.get("id"): dict(t) for t in (out.get("open_tasks") or []) if t.get("id")}
    remote_tasks = [t for t in (remote.get("open_tasks") or []) if isinstance(t, dict) and t.get("id")]
    for rt in remote_tasks:
        tid = rt["id"]
        lt = local_tasks.get(tid)
        if lt and str(lt.get("status") or "") in PROTECTED:
            notes.append(f"keep protected {tid} ({lt.get('status')})")
            continue
        if lt and str(lt.get("status") or "") in PROTECTED:
            continue
        # do not demote local commit/constrain via remote propose
        if lt and str(lt.get("status")) in PROTECTED:
            continue
        if not lt:
            local_tasks[tid] = rt
            notes.append(f"add remote {tid}")
        else:
            # allow remote to advance propose→constrain etc. if local still propose
            loc_st = str(lt.get("status") or "propose")
            rem_st = str(rt.get("status") or "propose")
            order = ["propose", "constrain", "revise", "commit", "escalate", "done", "drop"]
            if order.index(rem_st) if rem_st in order else 0 >= (order.index(loc_st) if loc_st in order else 0):
                if loc_st not in PROTECTED:
                    merged = dict(lt)
                    merged.update({k: rt[k] for k in ("status", "intent", "result", "sha", "constraints", "updated") if k in rt})
                    local_tasks[tid] = merged
                    notes.append(f"advance {tid} → {rem_st}")
    out["open_tasks"] = list(local_tasks.values())
    if remote.get("last_commit") and not out.get("last_commit"):
        out["last_commit"] = remote["last_commit"]
    if remote.get("version"):
        out["version"] = remote["version"]
    return out, notes


def http_json(method: str, url: str, token: str, body: dict | None = None, timeout: float = 20.0) -> dict:
    data = None
    headers = {
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
        "User-Agent": "fog-desk-sync/1.0",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"HTTP {e.code}: {err_body}") from e


def build_push_payload(git_sha: str = "") -> dict:
    state = sanitize_collegium(load_local_state())
    feed = feed_tail_local(40)
    # optional local mail digest if present (headers only)
    mail = {"mailbox": "", "ts": "", "n": 0, "latest": []}
    digest_path = FOG / "data/desk-mail-digest.json"
    if digest_path.is_file():
        try:
            mail = json.loads(digest_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "schema": "desk.snapshot.v1",
        "synced_at": _now(),
        "git": {"sha": (git_sha or "")[:40], "node": "FOG-NODE-PT-CM-001"},
        "mail": mail,
        # backward-compat top-level mail fields
        "mailbox": mail.get("mailbox") or "",
        "ts": mail.get("ts") or _now(),
        "n": mail.get("n") or 0,
        "latest": mail.get("latest") or [],
        "collegium": state,
        "feed_tail": feed,
    }


def pull(url: str | None = None) -> dict:
    token = load_desk_token()
    if not token:
        return {"ok": False, "error": "no_desk_token", "hint": "vault desk-mail.token or DESK_TOKEN in secrets.env"}
    url = url or DEFAULT_URL
    remote = http_json("GET", url, token)
    notes: list[str] = []
    local = load_local_state()
    collegium = remote.get("collegium") if isinstance(remote.get("collegium"), dict) else None
    if collegium:
        merged, mnotes = merge_collegium(local, collegium)
        save_local_state(merged)
        notes.extend(mnotes)
    # mail digest cache
    mail = remote.get("mail") if isinstance(remote.get("mail"), dict) else None
    if not mail and (remote.get("latest") is not None or remote.get("mailbox")):
        mail = {
            "mailbox": remote.get("mailbox") or "",
            "ts": remote.get("ts") or "",
            "n": remote.get("n") or 0,
            "latest": remote.get("latest") or [],
        }
    if mail:
        p = FOG / "data/desk-mail-digest.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(mail, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        notes.append(f"mail n={mail.get('n', 0)}")
    n_feed = append_feed_lines(remote.get("feed_tail") or [])
    if n_feed:
        notes.append(f"feed +{n_feed}")
    # announce pull on feed (no secrets)
    try:
        from desk_bus import feed_append  # type: ignore
    except Exception:
        feed_append = None
    line = "pull /desk ok" + ((" · " + "; ".join(notes[:4])) if notes else "")
    append_feed_lines([{
        "ts": _now(), "t": time.strftime("%H:%M:%S"),
        "agent": "stratagrok", "kind": "say", "specialty": "lead",
        "text": line[:240],
    }])
    return {"ok": True, "notes": notes, "remote_schema": remote.get("schema"), "url": url}


def push(url: str | None = None, git_sha: str = "") -> dict:
    token = load_desk_token()
    if not token:
        return {"ok": False, "error": "no_desk_token", "hint": "vault desk-mail.token or DESK_TOKEN in secrets.env"}
    url = url or DEFAULT_URL
    payload = build_push_payload(git_sha=git_sha)
    remote = http_json("POST", url, token, payload)
    append_feed_lines([{
        "ts": _now(), "t": time.strftime("%H:%M:%S"),
        "agent": "stratagrok", "kind": "say", "specialty": "lead",
        "text": f"push /desk ok tasks={len((payload.get('collegium') or {}).get('open_tasks') or [])}",
    }])
    return {"ok": True, "stored": bool(remote), "tasks": len((payload.get("collegium") or {}).get("open_tasks") or [])}


def sync_on_g(git_sha: str = "") -> str:
    """Optional one-shot after upgrade. Live updates use kick_desk_refresh (r/60s)."""
    parts = []
    try:
        pr = pull()
        if pr.get("ok"):
            parts.append("desk-pull ok")
        else:
            parts.append("desk-pull " + str(pr.get("error") or "fail"))
    except Exception as e:
        parts.append("desk-pull err")
        print(f"desk_sync pull: {e}", file=sys.stderr)
    try:
        pu = push(git_sha=git_sha)
        if pu.get("ok"):
            parts.append("desk-push ok")
        else:
            parts.append("desk-push " + str(pu.get("error") or "fail"))
    except Exception as e:
        parts.append("desk-push err")
        print(f"desk_sync push: {e}", file=sys.stderr)
    return " · ".join(parts) if parts else "desk-sync skip"


def main() -> int:
    import argparse
    p = argparse.ArgumentParser(description="Fog desk ↔ api-edge /desk sync")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("pull")
    sp = sub.add_parser("push")
    sp.add_argument("--sha", default="")
    sg = sub.add_parser("sync")
    sg.add_argument("--sha", default="")
    sub.add_parser("token-check")  # prints only yes/no, never the token
    args = p.parse_args()
    if args.cmd == "token-check":
        print("present" if load_desk_token() else "missing")
        return 0 if load_desk_token() else 2
    if args.cmd == "pull":
        print(json.dumps(pull(), indent=2))
        return 0
    if args.cmd == "push":
        print(json.dumps(push(git_sha=args.sha), indent=2))
        return 0
    if args.cmd == "sync":
        print(sync_on_g(git_sha=args.sha))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
