#!/usr/bin/env python3
"""desk-open — allowlisted browser/app launcher for FOG-CMN-DESK (workspace-local).

Prefer roster at (in order):
  1) $DESK_APPS_JSON
  2) <this-workspace>/desk-apps.json or bin/desk-apps.json
  3) ~/.hermes/desk-apps.json
  4) built-in defaults

Commands:
  status | list
  browser <id>     — open allowlisted URL id (from desk-apps.json browser.allowlist_urls)
  app <id>         — launch allowlisted app id (from desk-apps.json apps[])
  open <key>       — compat alias (browser id or app id or builtin key)
  url <url>        — open URL if allowlisted prefix

No secrets. See ACCESS.md + APPS.md in the Hermes desktop workspace.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

FOG_REPO = Path(os.environ.get("FOG_SRC", Path.home() / "StrataMesh" / "fog" / "repo"))
DESKTOP = FOG_REPO / "deploy" / "mac-fog" / "hermes" / "desktop"
HERE = Path(__file__).resolve().parent


def die(msg: str, code: int = 1) -> None:
    print(f"desk-open: {msg}", file=sys.stderr)
    raise SystemExit(code)


def roster_candidates() -> List[Path]:
    out: List[Path] = []
    if os.environ.get("DESK_APPS_JSON"):
        out.append(Path(os.environ["DESK_APPS_JSON"]))
    # Workspace-local first (Hermes FOG-CMN-DESK)
    out.extend(
        [
            HERE / "desk-apps.json",
            HERE.parent / "desk-apps.json" if HERE.name == "bin" else HERE / "desk-apps.json",
            DESKTOP / "desk-apps.json",
            DESKTOP / "bin" / "desk-apps.json",
            Path.home() / ".hermes" / "desk-apps.json",
        ]
    )
    # dedupe preserving order
    seen = set()
    uniq: List[Path] = []
    for p in out:
        try:
            rp = p.resolve()
        except Exception:
            rp = p
        if rp in seen:
            continue
        seen.add(rp)
        uniq.append(p)
    return uniq


def load_roster() -> Tuple[Dict[str, Any], Path]:
    for p in roster_candidates():
        if p.is_file():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data, p
            except Exception as e:
                print(f"desk-open: warn bad roster {p}: {type(e).__name__}", file=sys.stderr)
    return {"schema": "desk.apps.builtin", "browser": {"allowlist_urls": []}, "apps": []}, Path("(builtin)")


def pick_browser_app(preferred: Optional[List[str]] = None) -> str:
    names = preferred or ["Google Chrome", "Chromium", "Safari"]
    for name in names:
        if (Path("/Applications") / f"{name}.app").is_dir():
            return name
    return "Safari"


def url_prefixes_from_roster(roster: Dict[str, Any]) -> List[str]:
    prefixes = [
        "http://127.0.0.1:",
        "http://localhost:",
        "https://academy.calhegasmorais.pt",
        "https://calhegasmorais.pt",
        "https://fog.calhegasmorais.pt",
        "https://forum.calhegasmorais.pt",
        "https://discourse.stratamesh-laboratory.org",
        "https://github.com/StrataMesh-Laboratory",
        "https://console.cloud.google.com",
        "https://dash.cloudflare.com",
        "https://ollama.com",
    ]
    for item in (roster.get("browser") or {}).get("allowlist_urls") or []:
        if isinstance(item, dict) and item.get("url"):
            prefixes.append(str(item["url"]))
    return prefixes


def url_allowed(url: str, roster: Dict[str, Any]) -> bool:
    u = url.strip()
    return any(u.startswith(p) for p in url_prefixes_from_roster(roster))


def run_cmd(cmd: List[str], dry_run: bool = False) -> int:
    print(f"desk-open: {' '.join(cmd)}")
    if dry_run:
        print("desk-open: dry-run (not executed)")
        return 0
    return subprocess.run(cmd).returncode


def open_url(url: str, roster: Dict[str, Any], dry_run: bool) -> int:
    if not url_allowed(url, roster):
        die(f"URL not allowlisted: {url}")
    preferred = (roster.get("browser") or {}).get("preferred")
    browser = pick_browser_app(preferred if isinstance(preferred, list) else None)
    return run_cmd(["open", "-a", browser, url], dry_run=dry_run)


def browser_ids(roster: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for item in (roster.get("browser") or {}).get("allowlist_urls") or []:
        if isinstance(item, dict) and item.get("id") and item.get("url"):
            out[str(item["id"])] = item
    return out


def app_ids(roster: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for item in roster.get("apps") or []:
        if isinstance(item, dict) and item.get("id"):
            out[str(item["id"])] = item
    return out


def cmd_status(_args: argparse.Namespace, roster: Dict[str, Any], path: Path) -> int:
    browsers = browser_ids(roster)
    apps = app_ids(roster)
    preferred = (roster.get("browser") or {}).get("preferred") or []
    print("desk-open status")
    print(f"  roster: {path}")
    print(f"  schema: {roster.get('schema', '?')}")
    print(f"  workspace: {roster.get('workspace', 'FOG-CMN-DESK')}")
    print(f"  browser_pick: {pick_browser_app(preferred if isinstance(preferred, list) else None)}")
    print(f"  browser_urls: {len(browsers)}")
    for k, v in sorted(browsers.items()):
        print(f"    - {k}: {v.get('url')} ({v.get('why', '')})")
    print(f"  apps: {len(apps)}")
    for k, v in sorted(apps.items()):
        target = v.get("url") or " ".join(v.get("open") or []) or v.get("cmd") or ""
        opt = " optional" if v.get("optional") else ""
        print(f"    - {k}:{opt} {target} ({v.get('why', '')})")
    return 0


def cmd_browser(args: argparse.Namespace, roster: Dict[str, Any], _path: Path) -> int:
    browsers = browser_ids(roster)
    bid = args.id
    if bid not in browsers:
        die(f"unknown browser id {bid!r}; known: {', '.join(sorted(browsers)) or '(none)'}")
    return open_url(str(browsers[bid]["url"]), roster, dry_run=bool(args.dry_run))


def cmd_app(args: argparse.Namespace, roster: Dict[str, Any], _path: Path) -> int:
    apps = app_ids(roster)
    aid = args.id
    if aid not in apps:
        die(f"unknown app id {aid!r}; known: {', '.join(sorted(apps)) or '(none)'}")
    meta = apps[aid]
    if meta.get("url"):
        return open_url(str(meta["url"]), roster, dry_run=bool(args.dry_run))
    if meta.get("open"):
        cmd = [os.path.expanduser(str(c)) for c in meta["open"]]
        # optional apps: tolerate missing .app
        if meta.get("optional") and len(cmd) >= 3 and cmd[0] == "open" and cmd[1] == "-a":
            app_name = cmd[2]
            if not (Path("/Applications") / f"{app_name}.app").is_dir():
                print(f"desk-open: skip optional missing app {app_name}")
                return 0
        return run_cmd(cmd, dry_run=bool(args.dry_run))
    if meta.get("cmd"):
        # cmd may be a shell-ish description — try first token on PATH
        raw = str(meta["cmd"]).split()[0]
        # special: FogRuntime.command
        if "FogRuntime.command" in str(meta["cmd"]):
            path = FOG_REPO / "deploy" / "mac-fog" / "FogRuntime.command"
            return run_cmd(["open", str(path)], dry_run=bool(args.dry_run))
        if raw == "desk-mail":
            # prefer workspace-local bin
            for cand in (HERE / "desk-mail", DESKTOP / "bin" / "desk-mail", shutil.which("desk-mail")):
                if cand and Path(cand).exists():
                    return run_cmd([str(cand), "status"], dry_run=bool(args.dry_run))
        resolved = shutil.which(raw)
        if not resolved:
            if meta.get("optional"):
                print(f"desk-open: skip optional missing {raw}")
                return 0
            die(f"command not on PATH: {raw}")
        # safe info-only for CLIs
        extra = ["--help"] if raw in ("opencode", "openclaw", "hermes") else []
        if raw == "ollama":
            extra = ["list"]
        if raw == "desk-mail":
            extra = ["status"]
        return run_cmd([resolved, *extra], dry_run=bool(args.dry_run))
    die(f"app {aid}: no open/url/cmd")


def cmd_open(args: argparse.Namespace, roster: Dict[str, Any], path: Path) -> int:
    key = args.key
    if key in browser_ids(roster):
        args.id = key
        return cmd_browser(args, roster, path)
    if key in app_ids(roster):
        args.id = key
        return cmd_app(args, roster, path)
    die(f"unknown key {key!r}; try: desk-open list")


def cmd_url(args: argparse.Namespace, roster: Dict[str, Any], _path: Path) -> int:
    return open_url(args.url, roster, dry_run=bool(args.dry_run))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="desk-open",
        description="FOG-CMN-DESK allowlisted app/URL opener (workspace-local)",
    )
    p.add_argument("--dry-run", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="List linked browser ids + apps")
    sub.add_parser("list", help="Alias for status")
    bp = sub.add_parser("browser", help="Open allowlisted browser URL id")
    bp.add_argument("id")
    ap = sub.add_parser("app", help="Launch allowlisted app id")
    ap.add_argument("id")
    op = sub.add_parser("open", help="Compat: open browser/app id")
    op.add_argument("key")
    up = sub.add_parser("url", help="Open allowlisted URL")
    up.add_argument("url")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    dry = False
    if "--dry-run" in argv:
        dry = True
        argv = [a for a in argv if a != "--dry-run"]
    parser = build_parser()
    args = parser.parse_args(argv)
    args.dry_run = dry
    roster, path = load_roster()
    if args.cmd in ("status", "list"):
        return cmd_status(args, roster, path)
    if args.cmd == "browser":
        return cmd_browser(args, roster, path)
    if args.cmd == "app":
        return cmd_app(args, roster, path)
    if args.cmd == "open":
        return cmd_open(args, roster, path)
    if args.cmd == "url":
        return cmd_url(args, roster, path)
    die(f"unknown cmd {args.cmd}")


if __name__ == "__main__":
    raise SystemExit(main())
