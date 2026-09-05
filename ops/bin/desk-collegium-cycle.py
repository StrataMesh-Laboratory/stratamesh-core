#!/usr/bin/env python3
"""CI entry: protocol check + board summary + actions status (no Mac FOG required)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get("DESK_TICK_OUT") or (ROOT / "artifacts"))
OUT.mkdir(parents=True, exist_ok=True)


def run(cmd: list[str]) -> tuple[int, str]:
    r = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=120)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def main() -> int:
    report: dict = {"schema": "desk.collegium.cycle.v1", "ok": True, "steps": []}
    rc, out = run([sys.executable, "ops/desk-collegium/desk_protocol.py", "show"])
    report["steps"].append({"step": "protocol.show", "rc": rc})
    (OUT / "desk-protocol-show.json").write_text(out)
    os.environ.setdefault("FOG_HOME", str(OUT / "fog-home"))
    Path(os.environ["FOG_HOME"]).mkdir(parents=True, exist_ok=True)
    rc, out = run([sys.executable, "ops/desk-collegium/desk_protocol.py", "check"])
    report["steps"].append({"step": "protocol.check", "rc": rc, "out": out[-500:]})
    if rc != 0:
        report["ok"] = False
    rc, out = run([sys.executable, "ops/desk-collegium/desk_actions.py", "status"])
    report["steps"].append({"step": "actions.status", "rc": rc})
    (OUT / "desk-actions-status.txt").write_text(out)
    rc, out = run([sys.executable, "ops/desk-collegium/desk_connectors.py", "list"])
    report["steps"].append({"step": "connectors.list", "rc": rc})
    (OUT / "desk-collegium-cycle.json").write_text(json.dumps(report, indent=2) + "\n")
    md = [
        "# desk-collegium cycle (Actions)",
        "",
        f"ok={report['ok']}",
        "",
        "```json",
        json.dumps(report, indent=2)[:4000],
        "```",
        "",
        "Academy teach duty applies; desk agents are not SCA/ACB students.",
    ]
    (OUT / "desk-collegium.md").write_text("\n".join(md) + "\n")
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
