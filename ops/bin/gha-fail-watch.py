#!/usr/bin/env python3
"""Observe GitHub Actions failures. Notify #123. Never re-run, never PUT, never git.

Labor-only. Grok reads the log on #123 / the artifact and fixes.
#52 is locked/closed (lab-stress). Do not unlock or comment there.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

OWNER = os.environ.get("GITHUB_REPOSITORY_OWNER") or "StrataMesh-Laboratory"
REPO = (os.environ.get("GITHUB_REPOSITORY") or "StrataMesh-Laboratory/stratamesh-core").split("/")[-1]
ISSUE = int(os.environ.get("DESK_ISSUE") or "123")
API = f"https://api.github.com/repos/{OWNER}/{REPO}"
MARKER = "<!-- stratamesh-gha-fail-watch -->"
SELF = "gha-fail-watch"
HOURS = int(os.environ.get("FAIL_WATCH_HOURS") or "48")
# Observe-only / historical-red classes: never comment as "new failures".
IGNORE_NAMES = {
    SELF,
    "gitlive-drift",  # hold_put spa; check is observe-only
}
# GitHub `?status=failure` is NOT a filter (returns 0 or unfiltered). Always
# list completed and keep conclusion in REAL_FAIL. Skip cancelled/skipped.
REAL_FAIL = {"failure", "timed_out", "startup_failure"}


def token() -> str:
    for k in ("GITHUB_TOKEN", "GH_PAT", "GITHUB_PAT"):
        v = (os.environ.get(k) or "").strip()
        if v:
            return v
    p = Path("/tmp/gh_pat")
    if p.is_file():
        return p.read_text().strip()
    return ""


def api(path: str, method: str = "GET", body: dict | None = None, fatal: bool = True) -> dict | list:
    tok = token()
    if not tok:
        raise SystemExit("no GITHUB_TOKEN")
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + tok,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "StrataMesh-GHA-FailWatch/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode() or "{}"
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err = e.read()[:400].decode("utf-8", "replace")
        if fatal:
            raise SystemExit(f"GitHub {e.code} {path}: {err}")
        e._body = err  # type: ignore[attr-defined]
        raise


def list_failures() -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=HOURS)
    out: list[dict] = []
    # Page completed runs. Do not query status=failure (API ignores it).
    for page in (1, 2, 3):
        data = api(f"/actions/runs?status=completed&per_page=100&page={page}")
        runs = data.get("workflow_runs") or []
        if not runs:
            break
        for r in runs:
            if r.get("name") in IGNORE_NAMES:
                continue
            if (r.get("conclusion") or "") not in REAL_FAIL:
                continue
            if int(r.get("run_attempt") or 1) > 1 and r.get("conclusion") != "failure":
                continue
            created = r.get("created_at") or ""
            try:
                ts = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except Exception:
                continue
            if ts < cutoff:
                continue
            out.append(
                {
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "event": r.get("event"),
                    "conclusion": r.get("conclusion"),
                    "head_sha": (r.get("head_sha") or "")[:8],
                    "html_url": r.get("html_url"),
                    "created_at": created,
                    "path": (r.get("path") or ""),
                    "run_attempt": r.get("run_attempt"),
                }
            )
    # unique by id, newest first
    seen = set()
    uniq = []
    for row in sorted(out, key=lambda x: x["created_at"], reverse=True):
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        uniq.append(row)
    return uniq


def mentioned_ids() -> set[int]:
    ids: set[int] = set()
    # listComments is oldest-first. Page through so a long ledger still sees markers.
    try:
        for page in range(1, 6):
            comments = api(
                f"/issues/{ISSUE}/comments?per_page=100&page={page}", fatal=False
            )
            if not isinstance(comments, list) or not comments:
                break
            for c in comments:
                body = c.get("body") or ""
                if MARKER not in body and "actions/runs/" not in body:
                    continue
                for part in body.replace(")", " ").replace("]", " ").split():
                    if "actions/runs/" in part:
                        try:
                            ids.add(int(part.rstrip("/").split("actions/runs/")[-1].split("/")[0]))
                        except Exception:
                            pass
                    if part.startswith("run_id:"):
                        try:
                            ids.add(int(part.split(":", 1)[1]))
                        except Exception:
                            pass
            if len(comments) < 100:
                break
    except urllib.error.HTTPError as e:
        if e.code in (403, 404):
            print(f"skip-locked: GET comments #{ISSUE} HTTP {e.code}; known=empty")
            return set()
        err = getattr(e, "_body", "")
        raise SystemExit(f"GitHub {e.code} GET comments: {err}")
    return ids


def markdown(rows: list[dict], new: list[dict]) -> str:
    lines = [
        f"# GHA fail log {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "",
        f"window={HOURS}h · seen={len(rows)} · **new={len(new)}** · observe only (no re-run from Actions)",
        "",
        "| when | workflow | conclusion | sha | event | run |",
        "|---|---|---|---|---|---|",
    ]
    for r in rows:
        flag = " **NEW**" if r in new or r["id"] in {x["id"] for x in new} else ""
        lines.append(
            f"| {r['created_at'][:16]} | {r['name']}{flag} | {r['conclusion']} | `{r['head_sha']}` | {r['event']}"
            f" | [run]({r['html_url']}) |"
        )
    if not rows:
        lines.append("| — | none | — | — | — | — |")
    lines += [
        "",
        "Grok: inspect logs, fix, then `gh run rerun <id> --failed` **after** the fix is on main.",
        "Do not replay stale SHAs. gitlive-drift is observe-only (hold_put spa).",
        "Rerun only after the fix is on main HEAD — never the red historical SHA.",
        "",
    ]
    return "\n".join(lines) + "\n"


def comment_body(new: list[dict], md: str) -> str:
    ids = " ".join(f"run_id:{r['id']}" for r in new)
    return (
        "## GHA fail watch — new failures\n\n"
        + md
        + f"\n{ids}\n\n{MARKER}\n"
    )


def main() -> int:
    rows = list_failures()
    known = mentioned_ids()
    new = [r for r in rows if r["id"] not in known]
    md = markdown(rows, new)
    out = Path(os.environ.get("DESK_TICK_OUT") or "/tmp/desk-tick")
    out.mkdir(parents=True, exist_ok=True)
    (out / "FAIL-LOG.md").write_text(md)
    (out / "FAIL-LOG.json").write_text(
        json.dumps({"rows": rows, "new": new, "known": sorted(known)}, indent=2)
    )
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(md)
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"has_new={'true' if new else 'false'}\n")
            fh.write(f"new_count={len(new)}\n")
    sys.stdout.write(md)
    if new and os.environ.get("FAIL_WATCH_COMMENT", "1") not in ("0", "false"):
        try:
            api(
                f"/issues/{ISSUE}/comments",
                method="POST",
                body={"body": comment_body(new, md)},
                fatal=False,
            )
            print(f"commented #{ISSUE} new={len(new)}")
        except urllib.error.HTTPError as e:
            err = getattr(e, "_body", "") or ""
            locked = e.code in (403, 404) or "locked" in err.lower()
            if locked:
                (out / "FAIL-LOG.md").write_text(md)
                print(f"skip-locked: POST comment #{ISSUE} HTTP {e.code}")
                return 0
            raise SystemExit(f"GitHub {e.code} POST comment: {err}")
    else:
        print("no new failures to comment")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
