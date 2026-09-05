#!/usr/bin/env python3
"""Feed GitHub Issues + Challenges tab into the desk collegium bus.

- sync: open issues with labels lab|bug|challenge|desk|aiops → propose (idempotent by source id)
- challenges: local challenges.json items → propose
- ensure: create/update GH issues for open challenges; record number + html_url
- Never posts secrets. Uses gh CLI when available.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = "StrataMesh-Laboratory/stratamesh-core"
CHALLENGES = HERE / "challenges.json"
LABELS = ("challenge", "lab-desk", "desk", "bug")  # not blanket aiops (vapour)
MAX_NEW_PER_SYNC = 3
MARKER = "<!-- stratamesh-desk-challenge:"


def _bus():
    spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _gh_bin() -> str | None:
    import shutil
    import os
    for cand in (
        shutil.which("gh"),
        "/opt/homebrew/bin/gh",
        "/usr/local/bin/gh",
        str(Path.home() / "bin/gh"),
    ):
        if cand and Path(cand).is_file() and os.access(cand, os.X_OK):
            return cand
    return None


def _gh_issues(limit: int = 30) -> list[dict]:
    gh = _gh_bin()
    if not gh:
        return []
    try:
        r = subprocess.run(
            [
                gh, "api",
                f"repos/{REPO}/issues?state=open&per_page={limit}",
                "--jq",
                ".[] | {number,title,labels:[.labels[].name],html_url,body}",
            ],
            capture_output=True,
            text=True,
            timeout=40,
        )
        if r.returncode != 0:
            print(f"gh issues warn: {r.stderr.strip()[:200]}", file=sys.stderr)
            return []
        out = []
        for line in r.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        if not out and r.stdout.strip().startswith("["):
            out = json.loads(r.stdout)
        return out
    except Exception as e:
        print(f"gh issues error: {e}", file=sys.stderr)
        return []


def _already_sourced(state: dict, source: str) -> bool:
    for t in (state.get("open_tasks") or []) + (state.get("done_tasks") or []):
        if t.get("source") == source:
            return True
        # also match intent prefix
        intent = t.get("intent") or ""
        if source.startswith("issue:#") and source in intent:
            return True
    return False


def _specialty_from_labels(labels: list[str]) -> str:
    labs = {x.lower() for x in labels}
    if "track:edge" in labs or "edge" in labs:
        return "edge"
    if "challenge" in labs:
        return "coord"
    if "bug" in labs:
        return "code"
    if "aiops" in labs:
        return "fog"
    return "coord"


def _owner_for_spec(spec: str) -> str:
    return {
        "code": "opencode",
        "claw": "openclaw",
        "coord": "hermes",
        "lead": "stratagrok",
        "fog": "fog",
        "edge": "edge",
        "mail": "stratagrok",
    }.get(spec, "hermes")


def _load_challenges() -> dict:
    if not CHALLENGES.is_file():
        return {"schema": "desk.challenges.v1", "items": []}
    return json.loads(CHALLENGES.read_text(encoding="utf-8"))


def _save_challenges(data: dict) -> None:
    data = dict(data)
    data["updated"] = _now()
    CHALLENGES.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _find_existing_issue(cid: str, issues: list[dict]) -> dict | None:
    needle = f"{MARKER}{cid} -->"
    title_bit = cid
    for iss in issues:
        body = iss.get("body") or ""
        title = iss.get("title") or ""
        if needle in body:
            return iss
        if title_bit and title_bit in title:
            return iss
        labels = [str(x).lower() for x in (iss.get("labels") or [])]
        if "challenge" in labels and cid.replace("ch-", "") in title.lower():
            return iss
    return None


def _create_issue(ch: dict) -> dict | None:
    """Create a GH issue for a challenge. Returns {number, html_url} or None."""
    gh = _gh_bin()
    if not gh:
        print("ensure: gh unavailable — soft skip create", file=sys.stderr)
        return None
    cid = ch.get("id") or "challenge"
    title = f"[challenge] {ch.get('title') or cid}"
    body = "\n".join([
        f"## Desk challenge `{cid}`",
        "",
        str(ch.get("intent") or ""),
        "",
        f"- specialty: `{ch.get('specialty') or 'coord'}`",
        f"- source: `ops/desk-collegium/challenges.json`",
        f"- lab: Adversarial P1 · no workers.dev · no secrets in git",
        "",
        "Filed by `desk_issues.py ensure` so Act→metrics→fund can cite a real issue URL.",
        "",
        f"{MARKER}{cid} -->",
    ])
    try:
        r = subprocess.run(
            [
                gh, "issue", "create",
                "-R", REPO,
                "--title", title,
                "--body", body,
                "--label", "challenge",
                "--label", "lab-desk",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if r.returncode != 0:
            # labels may be missing — retry without labels
            err = (r.stderr or r.stdout or "")[:300]
            print(f"ensure create warn: {err}", file=sys.stderr)
            r2 = subprocess.run(
                [
                    gh, "issue", "create",
                    "-R", REPO,
                    "--title", title,
                    "--body", body,
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if r2.returncode != 0:
                print(f"ensure create fail: {(r2.stderr or r2.stdout or '')[:300]}", file=sys.stderr)
                return None
            url = (r2.stdout or "").strip()
        else:
            url = (r.stdout or "").strip()
        if not url or "github.com" not in url:
            return None
        # parse number from URL
        num = None
        try:
            num = int(url.rstrip("/").split("/")[-1])
        except Exception:
            num = None
        return {"number": num, "html_url": url}
    except Exception as e:
        print(f"ensure create error: {e}", file=sys.stderr)
        return None


def cmd_ensure(args: argparse.Namespace) -> int:
    """Create/update GH issues for open challenges; stamp challenges.json + bus tasks."""
    data = _load_challenges()
    issues = _gh_issues(50)
    created = 0
    updated = 0
    skipped = 0
    results = []
    for ch in data.get("items") or []:
        if ch.get("status") != "open":
            continue
        cid = ch.get("id")
        if not cid:
            continue
        # already stamped?
        if ch.get("github_issue") and ch.get("html_url") and not args.force:
            skipped += 1
            results.append({"id": cid, "status": "already", "html_url": ch.get("html_url")})
            continue
        existing = _find_existing_issue(cid, issues)
        if existing:
            ch["github_issue"] = existing.get("number")
            ch["html_url"] = existing.get("html_url") or ""
            updated += 1
            results.append({
                "id": cid,
                "status": "linked",
                "number": existing.get("number"),
                "html_url": existing.get("html_url"),
            })
            continue
        if args.dry_run:
            print(f"DRAFT create issue for {cid}: {ch.get('title')}")
            results.append({"id": cid, "status": "would_create"})
            continue
        got = _create_issue(ch)
        if not got:
            results.append({"id": cid, "status": "create_failed"})
            continue
        ch["github_issue"] = got.get("number")
        ch["html_url"] = got.get("html_url") or ""
        created += 1
        results.append({
            "id": cid,
            "status": "created",
            "number": got.get("number"),
            "html_url": got.get("html_url"),
        })
    if not args.dry_run and (created or updated):
        _save_challenges(data)
        # Do NOT bus.save_state here — FOG live state can be behind repo and
        # would clobber done Acts. cmd_sync stamps urls onto existing tasks.
        # refresh lab progress from repo challenges + state
        try:
            spec = importlib.util.spec_from_file_location("desk_metrics", HERE / "desk_metrics.py")
            m = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(m)
            m.update_lab_progress(write=True)
        except Exception as e:
            print(f"ensure metrics warn: {e}", file=sys.stderr)
    out = {
        "ok": True,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "results": results,
        "dry_run": bool(args.dry_run),
    }
    print(json.dumps(out, indent=2))
    return 0


def cmd_sync(args: argparse.Namespace) -> int:
    bus = _bus()
    state = bus.load_state()
    issues = _gh_issues(args.limit)
    added = 0
    for iss in issues:
        labels = [str(x).lower() for x in (iss.get("labels") or [])]
        # Strict: must carry an explicit desk label (no blanket aiops/domain vapour)
        if not any(l in LABELS for l in labels):
            continue
        source = f"issue:#{iss.get('number')}"
        if _already_sourced(state, source):
            continue
        title = str(iss.get("title") or "")
        # title dedupe against open intents
        norm = " ".join(title.lower().split())[:80]
        if any(norm and norm in (x.get("intent") or "").lower() for x in (state.get("open_tasks") or [])):
            continue
        if added >= MAX_NEW_PER_SYNC:
            print(f"sync cap MAX_NEW_PER_SYNC={MAX_NEW_PER_SYNC} — stop issues")
            break
        spec = _specialty_from_labels(labels)
        intent = f"{source} {title}"
        if args.dry_run:
            print(f"DRAFT {source} specialty={spec} {intent[:90]}")
            continue
        import argparse as ap
        ns = ap.Namespace(
            owner=_owner_for_spec(spec),
            specialty=spec,
            intent=intent[:200],
            id=f"dt-iss{iss.get('number')}",
            lanes=[],
        )
        # propose via bus
        rc = bus.cmd_propose(ns)
        if rc == 0:
            state = bus.load_state()
            task = bus.find_task(state, ns.id)
            if task:
                task["source"] = source
                task["url"] = iss.get("html_url") or ""
                task["labels"] = labels
                task["updated"] = _now()
                bus.save_state(state)
            added += 1
            print(f"proposed {ns.id} from {source}")
        elif "exists" in (""):
            pass
    # challenges file
    if CHALLENGES.is_file():
        data = json.loads(CHALLENGES.read_text(encoding="utf-8"))
        for ch in data.get("items") or []:
            if ch.get("status") != "open":
                continue
            source = f"challenge:{ch.get('id')}"
            if _already_sourced(state, source):
                # refresh URL if ensure stamped later
                if ch.get("html_url") and not args.dry_run:
                    state = bus.load_state()
                    for t in state.get("open_tasks") or []:
                        if t.get("source") == source and not t.get("url"):
                            t["url"] = ch["html_url"]
                            t["github_issue"] = ch.get("github_issue")
                            t["updated"] = _now()
                            bus.save_state(state)
                continue
            spec = ch.get("specialty") or "coord"
            intent = f"{source} {ch.get('title')}: {ch.get('intent') or ''}"
            if args.dry_run:
                print(f"DRAFT {source} specialty={spec} {intent[:90]}")
                continue
            import argparse as ap
            tid = f"dt-{str(ch.get('id') or 'ch')[:12].replace('_','')}"
            ns = ap.Namespace(
                owner=_owner_for_spec(spec),
                specialty=spec,
                intent=intent[:200],
                id=tid,
                lanes=[],
            )
            rc = bus.cmd_propose(ns)
            if rc == 0:
                state = bus.load_state()
                task = bus.find_task(state, tid)
                if task:
                    task["source"] = source
                    task["challenge"] = True
                    if ch.get("html_url"):
                        task["url"] = ch["html_url"]
                        task["github_issue"] = ch.get("github_issue")
                    task["updated"] = _now()
                    bus.save_state(state)
                added += 1
                print(f"proposed {tid} from {source}")
    if args.dry_run:
        print("(dry-run)")
    else:
        print(f"sync added={added}")
        # refresh feed mirror
        try:
            bus.cmd_list(state if False else bus.load_state())
        except Exception:
            pass
    return 0


def cmd_list(_: argparse.Namespace) -> int:
    bus = _bus()
    state = bus.load_state()
    n = 0
    for t in state.get("open_tasks") or []:
        src = t.get("source") or ""
        if src.startswith("issue:") or src.startswith("challenge:") or t.get("challenge"):
            print(f"{t.get('id')} [{t.get('status')}] {src} url={t.get('url') or '-'} {(t.get('intent') or '')[:70]}")
            n += 1
    if CHALLENGES.is_file():
        data = json.loads(CHALLENGES.read_text(encoding="utf-8"))
        print(f"challenges.json open={sum(1 for c in data.get('items') or [] if c.get('status')=='open')}")
        for c in data.get("items") or []:
            print(f"  {c.get('id')} [{c.get('status')}] issue={c.get('github_issue') or '-'} {c.get('html_url') or ''}")
    print(f"desk issue/challenge tasks={n}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Issues/Challenges → desk bus")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sync", help="ingest GH issues + challenges.json")
    s.add_argument("--dry-run", action="store_true")
    s.add_argument("--limit", type=int, default=30)
    e = sub.add_parser("ensure", help="create/link GH issues for open challenges")
    e.add_argument("--dry-run", action="store_true")
    e.add_argument("--force", action="store_true", help="re-link even if stamped")
    sub.add_parser("list", help="list desk tasks from issues/challenges")
    args = p.parse_args()
    if args.cmd == "sync":
        return cmd_sync(args)
    if args.cmd == "ensure":
        return cmd_ensure(args)
    if args.cmd == "list":
        return cmd_list(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
