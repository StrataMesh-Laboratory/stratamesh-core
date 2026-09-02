"""MacBook host cap — Fog must not ride the machine at the max.

Default ceiling is 60% of host load, memory, and disk. Lab is a MacBook,
not a server. Override with FOG_HOST_CAP (0-1).
"""
from __future__ import annotations

import os
import shutil
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



def _disk_frac() -> float:
    roots = []
    home = os.environ.get("FOG_HOME") or os.environ.get("FOG_DATA")
    if home:
        roots.append(home)
    roots.append(os.path.expanduser("~/StrataMesh/fog"))
    roots.append(os.path.expanduser("~"))
    roots.append("/")
    for root in roots:
        try:
            out = subprocess.check_output(["/bin/df", "-kP", root], text=True, timeout=3)
            line = [ln for ln in out.splitlines() if ln.strip()][-1]
            parts = line.split()
            used_k, avail_k = int(parts[2]), int(parts[3])
            total_k = used_k + avail_k
            if total_k > 0:
                return min(1.0, max(0.0, float(used_k) / float(total_k)))
        except Exception:
            continue
    return 0.0


def snapshot() -> dict[str, Any]:
    ncpu = os.cpu_count() or 1
    try:
        load1, load5, load15 = os.getloadavg()
    except Exception:
        load1 = load5 = load15 = 0.0
    load_frac = float(load1) / float(ncpu)
    mem_frac = _mem_frac()
    disk_frac = _disk_frac()
    cpu_frac = load_frac
    over = load_frac >= CAP or mem_frac >= CAP or disk_frac >= CAP
    reason = []
    if load_frac >= CAP:
        reason.append("load")
    if mem_frac >= CAP:
        reason.append("mem")
    if disk_frac >= CAP:
        reason.append("disk")
    return {
        "schema": "stratamesh.fog.host_cap.v1",
        "cap": CAP,
        "ncpu": ncpu,
        "load1": round(load1, 3),
        "load_frac": round(load_frac, 4),
        "mem_frac": round(mem_frac, 4),
        "disk_frac": round(disk_frac, 4),
        "cpu_frac": round(cpu_frac, 4),
        "over": over,
        "reason": ",".join(reason) or "ok",
        "backoff_sec": 60 if over else 0,
        "ts": time.time(),
        "note": "over → keep-up unready, no pending_poc, workerd poll stretched, no extra disk writes; over paces keep-up/PoC, does not unbind :8790/:8791/:8792",
    }


def over() -> bool:
    return bool(snapshot()["over"])
