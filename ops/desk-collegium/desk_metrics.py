#!/usr/bin/env python3
"""Desk performance metrics — sustained operative score + committed lab progress.

Writes cycle samples to:
  $FOG_HOME/data/desk-metrics.jsonl
  $FOG_HOME/data/last-cycle.jsonl   (alias mirror for Mac operative desk)

Committed objective metrics (fund + Discourse consume):
  status/desk-lab-progress.json

CLI:
  python3 ops/desk-collegium/desk_metrics.py score [--n 20]
  python3 ops/desk-collegium/desk_metrics.py snapshot [--write]
  python3 ops/desk-collegium/desk_metrics.py show
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PROGRESS_REL = Path("status/desk-lab-progress.json")
DISCOURSE_TOPIC = (
    "https://stratamesh.discourse.group/t/"
    "edge-grok-ops-pulse-mesh-api-edge-discovery-lab/20"
)
FUND_CANON = "https://fund.calhegasmorais.pt"
PT = timezone(timedelta(hours=1))


def _fog() -> Path:
    return Path(os.environ.get("FOG_HOME") or (Path.home() / "StrataMesh/fog"))


def metrics_path() -> Path:
    return _fog() / "data" / "desk-metrics.jsonl"


def last_cycle_path() -> Path:
    return _fog() / "data" / "last-cycle.jsonl"


def progress_path() -> Path:
    override = os.environ.get("DESK_LAB_PROGRESS")
    if override:
        return Path(override)
    return REPO_ROOT / PROGRESS_REL


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _now_iso_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _now_pt() -> str:
    return datetime.now(timezone.utc).astimezone(PT).strftime("%Y-%m-%dT%H:%M:%S%z")


def _git_sha() -> str:
    try:
        r = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if r.returncode == 0:
            return (r.stdout or "").strip()
    except Exception:
        pass
    return ""


def record(sample: dict) -> Path:
    """Append one cycle sample to desk-metrics.jsonl and last-cycle.jsonl."""
    sample = dict(sample)
    sample.setdefault("ts", _now())
    line = json.dumps(sample, ensure_ascii=False) + "\n"
    primary = metrics_path()
    mirror = last_cycle_path()
    for path in (primary, mirror):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(line)
    # Successful Act → refresh committed objective metrics (soft if repo RO)
    try:
        if int(sample.get("delivered") or 0) > 0 and not sample.get("idle_skip"):
            update_lab_progress(sample=sample, write=True)
    except Exception:
        pass
    return primary


def score_recent(n: int = 20) -> dict:
    """Compute 0..100 operative score from recent cycle samples."""
    primary = metrics_path()
    mirror = last_cycle_path()
    src = primary if primary.is_file() else (mirror if mirror.is_file() else None)
    if src is None:
        return {"ok": False, "reason": "no_samples", "score": 0}
    lines = src.read_text(encoding="utf-8").splitlines()[-n:]
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
        "source": str(src.name),
    }


# Back-compat alias used by callers / Mac docs
score = score_recent


def _load_state() -> dict:
    # Prefer repo mirror for committed progress; FOG live for Mac-only samples.
    # DESK_METRICS_FOG_STATE=1 flips preference (operative Mac score path).
    fog_first = os.environ.get("DESK_METRICS_FOG_STATE") == "1"
    candidates = [
        HERE / "state.json",
        _fog() / "data" / "desk-collegium" / "state.json",
    ]
    if fog_first:
        candidates = list(reversed(candidates))
    for p in candidates:
        if p.is_file():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                continue
    return {"open_tasks": [], "done_tasks": []}


def _load_challenges() -> dict:
    p = HERE / "challenges.json"
    if not p.is_file():
        return {"items": []}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"items": []}


def build_lab_progress(*, sample: dict | None = None) -> dict:
    """Build objective lab progress object from state + challenges + optional cycle sample."""
    state = _load_state()
    ch = _load_challenges()
    open_tasks = state.get("open_tasks") or []
    done = state.get("done_tasks") or []
    sha = _git_sha()

    issue_ids: list[int] = []
    issue_urls: list[str] = []
    for t in list(open_tasks) + list(done):
        src = str(t.get("source") or "")
        if src.startswith("issue:#"):
            try:
                issue_ids.append(int(src.split("#", 1)[1]))
            except Exception:
                pass
        url = t.get("url") or ""
        if url and "github.com" in str(url) and "/issues/" in str(url):
            issue_urls.append(str(url))
        # also record challenge→issue urls stamped on tasks
        if t.get("github_issue_url"):
            issue_urls.append(str(t["github_issue_url"]))

    items = []
    open_n = closed_n = 0
    for c in ch.get("items") or []:
        st = c.get("status") or "open"
        if st == "open":
            open_n += 1
        else:
            closed_n += 1
        html = c.get("html_url") or ""
        if html:
            issue_urls.append(str(html))
        gi = c.get("github_issue")
        if gi:
            try:
                issue_ids.append(int(gi))
            except Exception:
                pass
        items.append({
            "id": c.get("id"),
            "title": c.get("title"),
            "status": st,
            "specialty": c.get("specialty"),
            "github_issue": gi,
            "html_url": html,
        })

    issue_ids = sorted(set(issue_ids))
    issue_urls = sorted(set(u for u in issue_urls if u))

    unittest_ok = any(
        "unittest" in (t.get("result") or "") and "PASS" in (t.get("result") or "")
        for t in done
    )
    protocol_ok = True
    if sample is not None and "protocol_ok" in sample:
        protocol_ok = bool(sample.get("protocol_ok"))

    picked = []
    idle_skip = False
    if sample:
        picked = list(sample.get("picked") or [])
        idle_skip = bool(sample.get("idle_skip"))
        if sample.get("gh_ok") is not None:
            pass
    else:
        picked = [t.get("id") for t in done[-3:]]

    metrics_line = (
        f"desk lab P1 · sha={sha or '—'} · acts_done={len(done)} open={len(open_tasks)} · "
        f"challenges open={open_n} closed={closed_n} · issues={issue_ids or '—'} · "
        f"no EUR invented"
    )

    return {
        "schema": "desk.lab.progress.v1",
        "version": "0.6.0-lab",
        "phase": "P1",
        "phase_name": "Adversarial LAB P1",
        "lab": True,
        "not_mainnet": True,
        "updated_at": _now_iso_utc(),
        "updated_at_pt": _now_pt(),
        "git_sha": sha,
        "acts": {
            "delivered_total": len(done),
            "open_count": len(open_tasks),
            "last_picked": picked or [t.get("id") for t in done[-3:]],
            "idle_skip_last": idle_skip,
            "cycle_delivered": int((sample or {}).get("delivered") or 0),
            "recent_results": [
                {"id": t.get("id"), "result": (t.get("result") or "")[:120]}
                for t in done[-4:]
            ],
        },
        "pass_counts": {
            "desk_unittests_ok": unittest_ok,
            "protocol_ok": protocol_ok,
            "gh_ok": bool((sample or {}).get("gh_ok")) if sample else None,
            "acts_delivered": len(done),
            "challenges_open": open_n,
            "challenges_closed": closed_n,
            "issues_tracked": len(issue_ids),
        },
        "challenges": {
            "open": open_n,
            "closed": closed_n,
            "items": items,
        },
        "issues": {
            "tracked": issue_ids,
            "urls": issue_urls,
        },
        "discourse": {
            "topic": DISCOURSE_TOPIC,
            "metrics_line": metrics_line,
            "draft_hold": False,
        },
        "fund": {
            "canonical": FUND_CANON,
            "section": "lab-progress",
            "note": "Fed from this JSON — no invented dollars",
        },
        "source": "desk_metrics.update_lab_progress" if sample else "desk_metrics.snapshot",
        "note": "Objective lab metrics only — no EUR invented.",
    }


def update_lab_progress(*, sample: dict | None = None, write: bool = True) -> dict:
    """Rebuild lab progress; optionally write status/desk-lab-progress.json."""
    obj = build_lab_progress(sample=sample)
    if write:
        path = progress_path()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")
            obj["path"] = str(path)
            obj["written"] = True
        except Exception as e:
            obj["written"] = False
            obj["write_err"] = str(e)[:120]
    return obj


def load_lab_progress() -> dict | None:
    path = progress_path()
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def main() -> int:
    p = argparse.ArgumentParser(description="Desk metrics — operative score + lab progress")
    sub = p.add_subparsers(dest="cmd", required=True)
    sc = sub.add_parser("score", help="score recent cycle samples (0..100)")
    sc.add_argument("--n", type=int, default=20, help="lookback sample count")
    sn = sub.add_parser("snapshot", help="build objective lab progress JSON")
    sn.add_argument("--write", action="store_true", help=f"write {PROGRESS_REL}")
    sub.add_parser("show", help="print committed lab progress if present")
    args = p.parse_args()
    if args.cmd == "score":
        out = score_recent(args.n)
        print(json.dumps(out, indent=2))
        if out.get("reason") == "no_samples":
            return 0  # soft — first boot / empty FOG
        return 0 if out.get("ok") else 1
    if args.cmd == "snapshot":
        out = update_lab_progress(write=bool(args.write))
        print(json.dumps(out, indent=2))
        return 0
    if args.cmd == "show":
        cur = load_lab_progress()
        if not cur:
            print(json.dumps({"ok": False, "reason": "missing", "path": str(progress_path())}))
            return 1
        print(json.dumps(cur, indent=2))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
