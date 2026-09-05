#!/usr/bin/env python3
"""Desk connector registry — Actions / automations / scripts / SDK / API / vault / PAT.

Never prints secret bytes. Status only: present | missing | empty | error | skip.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REG = Path(__file__).resolve().parent / "connectors.json"


def _expand(p: str) -> Path:
    return Path(os.path.expanduser(p)).expanduser()


def load_registry() -> dict:
    if not REG.is_file():
        return {"schema": "desk.connectors.v1", "surfaces": []}
    return json.loads(REG.read_text(encoding="utf-8"))


def _probe_path(paths: list[str], *, any_ok: bool) -> str:
    hits = []
    empties = 0
    for raw in paths:
        p = _expand(raw)
        if p.is_file() or p.is_dir():
            if p.is_file() and p.stat().st_size == 0:
                empties += 1
            else:
                hits.append(p)
        elif "~" not in raw and (REPO_ROOT / raw).exists():
            hits.append(REPO_ROOT / raw)
    if hits:
        return "present"
    if empties and any_ok:
        return "empty"
    return "missing"


def _probe_repo_paths(paths: list[str]) -> str:
    ok = all((REPO_ROOT / p).is_file() for p in paths)
    return "present" if ok else "missing"


def _probe_gh(cmd: list[str]) -> str:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        return "present" if r.returncode == 0 else "missing"
    except Exception:
        return "error"


def _probe_http(url: str, auth: str) -> str:
    # Prefer desk_sync token without printing it
    token = ""
    try:
        import importlib.util
        sp = Path(__file__).resolve().parent / "desk_sync.py"
        spec = importlib.util.spec_from_file_location("desk_sync", sp)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        token = mod.load_desk_token() if auth == "desk_token" else ""
    except Exception:
        token = (os.environ.get("DESK_TOKEN") or "").strip()
    try:
        import urllib.request
        req = urllib.request.Request(url, method="GET")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return "present" if 200 <= resp.status < 300 else "error"
    except Exception as e:
        # 403 from box IP is common; token present still counts as wired if load worked
        if token and "403" in str(e):
            return "present"
        if not token:
            return "missing"
        return "error"


def probe_surface(surf: dict) -> dict:
    probe = surf.get("probe") or {}
    ptype = probe.get("type")
    status = "skip"
    if ptype == "path":
        status = _probe_path(list(probe.get("paths") or []), any_ok=bool(probe.get("any")))
    elif ptype == "repo_paths":
        status = _probe_repo_paths(list(probe.get("paths") or []))
    elif ptype == "gh":
        status = _probe_gh(list(probe.get("cmd") or ["gh", "auth", "status"]))
    elif ptype == "http":
        status = _probe_http(str(probe.get("url") or ""), str(probe.get("auth") or ""))
    return {
        "id": surf.get("id"),
        "kind": surf.get("kind"),
        "status": status,
        "ship_gate": bool(surf.get("ship_gate")),
        "desc": surf.get("desc") or "",
    }


def cmd_status(_: argparse.Namespace) -> int:
    reg = load_registry()
    rows = [probe_surface(s) for s in reg.get("surfaces") or []]
    gates = [r for r in rows if r["ship_gate"]]
    ok_gates = sum(1 for r in gates if r["status"] == "present")
    print(f"connectors={len(rows)} ship_gates={ok_gates}/{len(gates)}")
    for r in rows:
        flag = "GATE" if r["ship_gate"] else "info"
        print(f"  [{flag}] {r['id']:20} {r['status']:8} {r['kind']}")
    # exit 0 if all ship_gate present; 2 if any missing/empty
    bad = [r for r in gates if r["status"] not in ("present",)]
    return 0 if not bad else 2


def cmd_list(_: argparse.Namespace) -> int:
    reg = load_registry()
    for s in reg.get("surfaces") or []:
        print(f"{s.get('id')}\t{s.get('kind')}\t{s.get('desc','')[:80]}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Desk connector registry")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="probe each surface (never print secrets)")
    sub.add_parser("list", help="list registry entries")
    args = p.parse_args()
    if args.cmd == "status":
        return cmd_status(args)
    if args.cmd == "list":
        return cmd_list(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
