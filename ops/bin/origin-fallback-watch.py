#!/usr/bin/env python3
"""GHA observer for Fog origin. Never flips DNS. Never prints secrets."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen

PUBLIC = os.environ.get("FOG_PUBLIC_URL") or "https://fog.calhegasmorais.pt/health"
OUT = Path(os.environ.get("GITHUB_OUTPUT") or "/dev/null")
MD = Path("origin-fallback.md")
UA = "Mozilla/5.0 (compatible; StrataMesh-origin-fallback-watch/1)"


def probe() -> dict:
    try:
        req = Request(PUBLIC, headers={"User-Agent": UA})
        with urlopen(req, timeout=12) as r:
            body = r.read().decode("utf-8", "replace")
            data = json.loads(body) if body.startswith("{") else {"raw": body[:200]}
            return {"ok": r.status == 200, "status": r.status, **data}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def write_output(k: str, v: str) -> None:
    try:
        with OUT.open("a", encoding="utf-8") as fh:
            fh.write(f"{k}={v}\n")
    except Exception:
        pass


def main() -> int:
    p = probe()
    origin = p.get("origin") or "DARK"
    dark = not (p.get("ok") and origin in ("macbook", "session"))
    fallback = bool(p.get("ok") and origin == "session")
    print(json.dumps({"origin": origin, "ok": p.get("ok"), "fallback": fallback, "dark": dark, "probe": p}, indent=2))
    write_output("origin", str(origin))
    write_output("dark", "true" if dark else "false")
    write_output("fallback", "true" if fallback else "false")
    if dark:
        MD.write_text(
            "## origin-fallback watch\n\n"
            f"Public `{PUBLIC}` is **DARK** (not macbook, not session).\n\n"
            f"```json\n{json.dumps(p, indent=2)}\n```\n\n"
            "Session persist should take DNS after 30 min Mac-down if this host is up.\n"
            "Operator: `python3 ops/bin/fog-persist.py --status`\n",
            encoding="utf-8",
        )
    elif fallback:
        MD.write_text(
            f"## origin-fallback watch\n\nSession fallback **live** (`origin=session`). Mac still primary when healthy.\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
