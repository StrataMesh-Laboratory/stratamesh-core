"""MacBook host cap — Fog must not ride the machine at the max.

Default ceiling is 60% of host load, CPU, and memory. Lab is a MacBook,
not a server. Override with FOG_HOST_CAP (0-1).
"""
from __future__ import annotations

import os
import time
from typing import Any

CAP = float(os.environ.get("FOG_HOST_CAP") or "0.60")
if CAP <= 0 or CAP > 1:
    CAP = 0.60


def _mem_frac() -> float:
    try:
        import psutil  # type: ignore
        return float(psutil.virtual_memory().percent) / 100.0
    except Exception:
        pass
    try:
        page = 4096
        total = None
        used = None
        # macOS vm_stat
        import subprocess
        out = subprocess.check_output(["vm_stat"], text=True, timeout=1.5)
        pages = {}
        for line in out.splitlines():
            if "page size" in line.lower():
                try:
                    page = int("".join(c for c in line if c.isdigit()) or "4096")
                except ValueError:
                    page = 4096
            if ":" in line:
                k, v = line.split(":", 1)
                digits = "".join(c for c in v if c.isdigit())
                if digits:
                    pages[k.strip().lower()] = int(digits)
        free = pages.get("pages free", 0) + pages.get("pages speculative", 0)
        active = pages.get("pages active", 0)
        wired = pages.get("pages wired down", 0) or pages.get("pages wired", 0)
        compact = pages.get("pages occupied by compressor", 0)
        used_pages = active + wired + compact
        total_pages = used_pages + free + pages.get("pages inactive", 0)
        if total_pages > 0:
            return min(1.0, used_pages / total_pages)
    except Exception:
        pass
    return 0.0


def snapshot() -> dict[str, Any]:
    ncpu = os.cpu_count() or 1
    try:
        load1, load5, load15 = os.getloadavg()
    except Exception:
        load1 = load5 = load15 = 0.0
    load_frac = float(load1) / float(ncpu)
    mem_frac = _mem_frac()
    cpu_frac = load_frac  # load/ncpu is the honest MacBook pressure
    over = load_frac >= CAP or mem_frac >= CAP
    return {
        "schema": "stratamesh.fog.host_cap.v1",
        "cap": CAP,
        "ncpu": ncpu,
        "load1": round(load1, 3),
        "load_frac": round(load_frac, 4),
        "mem_frac": round(mem_frac, 4),
        "cpu_frac": round(cpu_frac, 4),
        "over": over,
        "backoff_sec": 60 if over else 0,
        "ts": time.time(),
        "note": "over → keep-up unready, no pending_poc, workerd poll stretched",
    }


def over() -> bool:
    return bool(snapshot()["over"])
