#!/usr/bin/env python3
"""Enforce automation-desk methodology (desk.protocol.v1)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROTO = HERE / "protocol.json"


def load_protocol() -> dict:
    return json.loads(PROTO.read_text(encoding="utf-8")) if PROTO.is_file() else {}


def check(state: dict | None = None) -> dict:
    """Return {ok, violations[], laws_ok}. Never prints secrets."""
    proto = load_protocol()
    violations = []
    laws = proto.get("laws") or []
    if not proto:
        violations.append("missing protocol.json")
    # structural checks against state if provided
    if state is not None:
        open_tasks = state.get("open_tasks") or []
        # anti_vapour signal: too many propose with no specialty handler path
        specs = {t.get("specialty") for t in open_tasks}
        if len(open_tasks) > 40:
            violations.append("anti_vapour: open_tasks>40 (capacity flood)")
        # no_sca: owners must not claim sca
        for t in open_tasks:
            own = str(t.get("owner") or "").lower()
            if "sca" in own or "acb" in own:
                violations.append(f"no_sca: task {t.get('id')} owner looks SCA/ACB")
        # ship_live without votes is ok until ship; last_ship authority check
        ls = state.get("last_ship") or {}
        if ls and ls.get("authority") not in (None, "majority", "unanimous", ""):
            if ls.get("authority") == "none":
                violations.append("ship_majority: last_ship authority=none")
        # human gate honesty: done tasks must not claim oracle fake
        for t in state.get("done_tasks") or []:
            res = str(t.get("result") or "").lower()
            if "oracle" in res and "fake" in res:
                violations.append(f"human_gates: suspicious result on {t.get('id')}")
    ok = not violations
    return {
        "ok": ok,
        "schema": proto.get("schema"),
        "version": proto.get("version"),
        "laws": len(laws),
        "violations": violations,
    }


def cmd_show(_: argparse.Namespace) -> int:
    proto = load_protocol()
    print(json.dumps({"schema": proto.get("schema"), "version": proto.get("version"), "laws": [l.get("id") for l in proto.get("laws") or []], "cycle": proto.get("cycle"), "deny": proto.get("deny")}, indent=2))
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    state = None
    if args.state:
        state = json.loads(Path(args.state).read_text(encoding="utf-8"))
    else:
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location("desk_bus", HERE / "desk_bus.py")
            mod = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(mod)
            state = mod.load_state()
        except Exception:
            state = None
    r = check(state)
    print(json.dumps(r, indent=2))
    return 0 if r["ok"] else 2


def main() -> int:
    p = argparse.ArgumentParser(description="Desk protocol enforce")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("show", help="print protocol summary")
    c = sub.add_parser("check", help="enforce laws against live state")
    c.add_argument("--state", default="")
    args = p.parse_args()
    if args.cmd == "show":
        return cmd_show(args)
    if args.cmd == "check":
        return cmd_check(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
