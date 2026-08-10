"""
Process resource meter — Track B3
=================================
Samples host/process CPU and memory to drive ACB PoSbs consume estimates.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import os
import time


@dataclass
class ResourceSample:
    cpu_percent: float
    mem_rss_mb: float
    mem_percent: float
    timestamp: float
    source: str  # psutil | proc | fallback


def _from_psutil() -> Optional[ResourceSample]:
    try:
        import psutil  # type: ignore

        p = psutil.Process(os.getpid())
        # first call may be 0; sample briefly
        p.cpu_percent(interval=None)
        time.sleep(0.05)
        cpu = float(p.cpu_percent(interval=0.1))
        mem = p.memory_info()
        vm = psutil.virtual_memory()
        return ResourceSample(
            cpu_percent=cpu,
            mem_rss_mb=mem.rss / (1024 * 1024),
            mem_percent=float(vm.percent),
            timestamp=time.time(),
            source="psutil",
        )
    except Exception:
        return None


def _from_proc() -> Optional[ResourceSample]:
    try:
        # RSS from /proc/self/status
        rss_kb = 0.0
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    rss_kb = float(line.split()[1])
                    break
        # crude load
        load1 = 0.0
        with open("/proc/loadavg") as f:
            load1 = float(f.read().split()[0])
        cpus = os.cpu_count() or 1
        cpu_pct = min(100.0, (load1 / cpus) * 100.0)
        return ResourceSample(
            cpu_percent=cpu_pct,
            mem_rss_mb=rss_kb / 1024.0,
            mem_percent=0.0,
            timestamp=time.time(),
            source="proc",
        )
    except Exception:
        return None


def sample() -> ResourceSample:
    s = _from_psutil()
    if s:
        return s
    s = _from_proc()
    if s:
        return s
    return ResourceSample(
        cpu_percent=1.0,
        mem_rss_mb=32.0,
        mem_percent=0.0,
        timestamp=time.time(),
        source="fallback",
    )


def estimate_consume(sample: ResourceSample, scale: float = 0.05) -> float:
    """
    Map sample → PoSbs compute consume units.
    Higher CPU/mem → higher consume.
    """
    cpu_term = sample.cpu_percent / 100.0
    mem_term = min(1.0, sample.mem_rss_mb / 512.0)
    return max(0.01, scale * (0.7 * cpu_term + 0.3 * mem_term) * 10.0)


def demo():
    s = sample()
    print(s)
    print("consume_est", estimate_consume(s))
    print("resource_meter demo OK")


if __name__ == "__main__":
    demo()
