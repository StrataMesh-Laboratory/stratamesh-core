#!/usr/bin/env python3
"""desk-open — allowlisted browser/app launcher for FOG-CMN-DESK agents.

No secrets. Opens only URLs/apps listed in ~/.hermes/desk-apps.json
(or the repo desktop roster). Commands: status | list | open <key> | url <url>
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

FOG_REPO = Path(os.environ.get("FOG_SRC", Path.home() / "StrataMesh" / "fog" / "repo"))
DESK_APPS_JSON = Path.home() / ".hermes" / "desk-apps.json"
REPO_APPS_MD = FOG_REPO / "deploy" / "mac-fog" / "hermes" / "desktop" / "APPS.md"

# Canonical allowlist (paths/URLs only — never tokens)
DEFAULT_APPS: Dict[str, Dict[str, Any]] = {
    "browser": {
        "kind": "app",
        "label": "Default browser (Chrome preferred, else Safari)",
        "open": ["chrome_or_safari"],
        "notes": "Used for CF / GitHub / Discourse / GCP / Fog health / academy",
    },
    "chrome": {
        "kind": "app",
        "label": "Google Chrome",
        "app": "Google Chrome",
    },
    "safari": {
        "kind": "app",
        "label": "Safari",
        "app": "Safari",
    },
    "snappymail": {
        "kind": "url",
        "label": "SnappyMail (automation.desk)",
        "url": "http://127.0.0.1:8099",
        "notes": "Local hop; automation.desk account when configured",
    },
    "fog-health": {
        "kind": "url",
        "label": "Fog health",
        "url": "http://127.0.0.1:8787/health",
    },
    "academy": {
        "kind": "url",
        "label": "Academy",
        "url": "https://academy.calhegasmorais.pt",
    },
    "github": {
        "kind": "url",
        "label": "GitHub StrataMesh-Laboratory",
        "url": "https://github.com/StrataMesh-Laboratory",
    },
    "discourse": {
        "kind": "url",
        "label": "Discourse (calhegasmorais)",
        "url": "https://forum.calhegasmorais.pt",
    },
    "gcp": {
        "kind": "url",
        "label": "GCP console",
        "url": "https://console.cloud.google.com/",
    },
    "cloudflare": {
        "kind": "url",
        "label": "Cloudflare dashboard",
        "url": "https://dash.cloudflare.com/",
    },
    "terminal": {
        "kind": "app",
        "label": "Terminal",
        "app": "Terminal",
    },
    "iterm": {
        "kind": "app",
        "label": "iTerm",
        "app": "iTerm",
        "optional": True,
    },
    "fog-tui": {
        "kind": "command",
        "label": "Fog TUI",
        "command": [
            "open",
            str(FOG_REPO / "deploy" / "mac-fog" / "FogRuntime.command"),
        ],
        "alt": "python3 deploy/mac-fog/fog-tui.py",
    },
    "fog-runtime": {
        "kind": "command",
        "label": "FogRuntime.command",
        "command": [
            "open",
            str(FOG_REPO / "deploy" / "mac-fog" / "FogRuntime.command"),
        ],
    },
    "opencode": {
        "kind": "command",
        "label": "OpenCode CLI",
        "command": ["opencode", "--help"],
        "notes": "CLI on PATH; project under FOG_SRC",
    },
    "openclaw": {
        "kind": "url",
        "label": "OpenClaw gateway (local WS note)",
        "url": "http://127.0.0.1:18789",
        "notes": "Gateway; WS ws://127.0.0.1:18789 — do not dump tokens",
    },
    "ollama": {
        "kind": "command",
        "label": "Ollama",
        "command": ["ollama", "list"],
        "notes": "Local or cloud via vault token path only",
    },
    "maildir": {
        "kind": "command",
        "label": "Finder → ~/mail/automation.desk",
        "command": ["open", str(Path.home() / "mail" / "automation.desk")],
    },
    "desk-mail": {
        "kind": "command",
        "label": "desk-mail status",
        "command": ["desk-mail", "status"],
    },
}

# URL allowlist prefixes for `desk-open url …`
URL_ALLOW_PREFIXES = (
    "http://127.0.0.1:",
    "http://localhost:",
    "https://academy.calhegasmorais.pt",
    "https://calhegasmorais.pt",
    "https://forum.calhegasmorais.pt",
    "https://github.com/StrataMesh-Laboratory",
    "https://console.cloud.google.com",
    "https://dash.cloudflare.com",
    "https://ollama.com",
)


def die(msg: str, code: int = 1) -> None:
    print(f"desk-open: {msg}", file=sys.stderr)
    raise SystemExit(code)


def load_roster() -> Dict[str, Dict[str, Any]]:
    if DESK_APPS_JSON.is_file():
        try:
            data = json.loads(DESK_APPS_JSON.read_text(encoding="utf-8"))
            apps = data.get("apps") if isinstance(data, dict) else None
            if isinstance(apps, dict) and apps:
                return apps
        except Exception as e:
            print(f"desk-open: warn bad {DESK_APPS_JSON}: {type(e).__name__}", file=sys.stderr)
    return dict(DEFAULT_APPS)


def url_allowed(url: str) -> bool:
    u = url.strip()
    return any(u.startswith(p) for p in URL_ALLOW_PREFIXES)


def pick_browser_app() -> str:
    for name in ("Google Chrome", "Chromium", "Safari"):
        # `open -a` resolves by name; probe via mdfind/ls Applications lightly
        app_path = Path("/Applications") / f"{name}.app"
        if app_path.is_dir():
            return name
    return "Safari"


def run_open_app(app_name: str, url: Optional[str] = None, dry_run: bool = False) -> int:
    cmd = ["open", "-a", app_name]
    if url:
        cmd.append(url)
    print(f"desk-open: {' '.join(cmd)}")
    if dry_run:
        print("desk-open: dry-run (not executed)")
        return 0
    return subprocess.run(cmd).returncode


def run_open_url(url: str, dry_run: bool = False) -> int:
    if not url_allowed(url):
        die(f"URL not allowlisted: {url}")
    browser = pick_browser_app()
    return run_open_app(browser, url=url, dry_run=dry_run)


def run_command(cmd: List[str], dry_run: bool = False) -> int:
    print(f"desk-open: exec {' '.join(cmd)}")
    if dry_run:
        print("desk-open: dry-run (not executed)")
        return 0
    # For `open` of local paths, just run; for CLI help-ish, capture briefly
    if cmd and cmd[0] == "open":
        return subprocess.run(cmd).returncode
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    out = (p.stdout or "")[:500]
    err = (p.stderr or "")[:300]
    if out.strip():
        print(out.rstrip())
    if p.returncode != 0 and err.strip():
        print(err.rstrip(), file=sys.stderr)
    return p.returncode


def cmd_status(_args: argparse.Namespace) -> int:
    apps = load_roster()
    print("desk-open status")
    print(f"  roster: {DESK_APPS_JSON if DESK_APPS_JSON.is_file() else '(defaults)'}")
    print(f"  apps: {len(apps)}")
    print(f"  browser_pick: {pick_browser_app()}")
    print(f"  apps_md: {'yes' if REPO_APPS_MD.is_file() else 'no'}")
    for key in sorted(apps.keys()):
        meta = apps[key]
        kind = meta.get("kind", "?")
        label = meta.get("label", key)
        target = meta.get("url") or meta.get("app") or " ".join(meta.get("command") or []) or ""
        opt = " optional" if meta.get("optional") else ""
        print(f"  - {key}: [{kind}]{opt} {label} → {target}")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    return cmd_status(args)


def resolve_and_open(key: str, dry_run: bool) -> int:
    apps = load_roster()
    if key not in apps:
        die(f"unknown app key {key!r}; try: desk-open status")
    meta = apps[key]
    kind = meta.get("kind")
    if kind == "url":
        return run_open_url(str(meta["url"]), dry_run=dry_run)
    if kind == "app":
        if key == "browser" or meta.get("open") == ["chrome_or_safari"]:
            return run_open_app(pick_browser_app(), dry_run=dry_run)
        app = meta.get("app")
        if not app:
            die(f"{key}: missing app name")
        return run_open_app(str(app), dry_run=dry_run)
    if kind == "command":
        cmd = meta.get("command")
        if not isinstance(cmd, list) or not cmd:
            die(f"{key}: missing command")
        # expand ~ in args
        cmd = [os.path.expanduser(str(c)) for c in cmd]
        # resolve desk-mail / opencode / ollama on PATH
        if cmd[0] not in ("open",) and not Path(cmd[0]).is_file():
            resolved = shutil.which(cmd[0])
            if not resolved:
                if meta.get("optional"):
                    print(f"desk-open: skip optional missing {cmd[0]}")
                    return 0
                die(f"command not on PATH: {cmd[0]}")
            cmd[0] = resolved
        return run_command(cmd, dry_run=dry_run)
    die(f"{key}: unknown kind {kind!r}")


def cmd_open(args: argparse.Namespace) -> int:
    return resolve_and_open(args.key, dry_run=bool(args.dry_run))


def cmd_url(args: argparse.Namespace) -> int:
    return run_open_url(args.url, dry_run=bool(args.dry_run))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="desk-open", description="FOG-CMN-DESK allowlisted app/URL opener")
    p.add_argument("--dry-run", action="store_true", help="Print action only")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="List linked apps")
    sub.add_parser("list", help="Alias for status")
    op = sub.add_parser("open", help="Open allowlisted app key")
    op.add_argument("key")
    up = sub.add_parser("url", help="Open allowlisted URL in browser")
    up.add_argument("url")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    # allow global --dry-run before or after subcommand
    argv = list(sys.argv[1:] if argv is None else argv)
    dry = False
    if "--dry-run" in argv:
        dry = True
        argv = [a for a in argv if a != "--dry-run"]
    parser = build_parser()
    args = parser.parse_args(argv)
    args.dry_run = dry or bool(getattr(args, "dry_run", False))
    if args.cmd in ("status", "list"):
        return cmd_status(args)
    if args.cmd == "open":
        return cmd_open(args)
    if args.cmd == "url":
        return cmd_url(args)
    die(f"unknown cmd {args.cmd}")


if __name__ == "__main__":
    raise SystemExit(main())
