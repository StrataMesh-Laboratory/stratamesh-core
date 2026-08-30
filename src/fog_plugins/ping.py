"""Runtime ping for the Mac Fog hop.

Targets are loopback workerd (:8788) and in-process Fog (:8787).
Public origin is opt-in. workers.dev is refused.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.request import Request, urlopen

POLL_SEC = float(os.environ.get("FOG_PING_SEC") or "15")
FOG_PORT = int(os.environ.get("FOG_PORT") or "8787")
WORKERD_PORT = int(os.environ.get("WORKERD_PORT") or "8788")


def refuse_workers_dev(url: str) -> bool:
    return "workers.dev" in (url or "").lower()


@dataclass
class PingTarget:
    name: str
    url: str
    required: bool = True


@dataclass
class PingResult:
    name: str
    url: str
    ok: bool
    status: Optional[int]
    rtt_ms: float
    unready: bool
    error: Optional[str]
    ts: float = field(default_factory=time.time)


class PingPlugin:
    def __init__(self, targets: Optional[List[PingTarget]] = None):
        self.targets = targets or default_targets()
        self.history: List[PingResult] = []
        self.last: dict[str, PingResult] = {}
        self.ok_n = 0
        self.fail_n = 0
        self.rtt_ema = 0.0
        self.started_at = time.time()

    def ping_one(self, t: PingTarget) -> PingResult:
        if refuse_workers_dev(t.url):
            r = PingResult(t.name, t.url, False, None, 0.0, True, "workers.dev refused")
            self._remember(r)
            return r
        t0 = time.perf_counter()
        try:
            req = Request(t.url, headers={"User-Agent": "fog-ping/1", "Accept": "application/json"})
            with urlopen(req, timeout=2.5) as resp:
                body = resp.read(4096)
                rtt = (time.perf_counter() - t0) * 1000.0
                unready = resp.status != 200 or not body
                r = PingResult(t.name, t.url, resp.status == 200 and not unready, resp.status, rtt, unready, None)
        except Exception as e:
            rtt = (time.perf_counter() - t0) * 1000.0
            r = PingResult(t.name, t.url, False, None, rtt, True, type(e).__name__)
        self._remember(r)
        return r

    def _remember(self, r: PingResult) -> None:
        self.last[r.name] = r
        self.history.append(r)
        if len(self.history) > 240:
            self.history = self.history[-240:]
        if r.ok:
            self.ok_n += 1
            self.rtt_ema = r.rtt_ms if self.rtt_ema <= 0 else 0.7 * self.rtt_ema + 0.3 * r.rtt_ms
        else:
            self.fail_n += 1

    def tick(self) -> List[PingResult]:
        return [self.ping_one(t) for t in self.targets]

    def snapshot(self) -> dict:
        last = {k: {
            "ok": v.ok,
            "status": v.status,
            "rtt_ms": round(v.rtt_ms, 2),
            "unready": v.unready,
            "error": v.error,
            "url": v.url,
        } for k, v in self.last.items()}
        total = max(1, self.ok_n + self.fail_n)
        return {
            "plugin": "fog-ping",
            "ok": all(v.ok for v in self.last.values()) if self.last else False,
            "targets": [t.name for t in self.targets],
            "last": last,
            "ok_n": self.ok_n,
            "fail_n": self.fail_n,
            "ok_ratio": round(self.ok_n / total, 4),
            "rtt_ema_ms": round(self.rtt_ema, 2),
            "uptime_s": int(time.time() - self.started_at),
            "note": "loopback hop; public origin opt-in; workers.dev refused",
        }


def default_targets() -> List[PingTarget]:
    # Fog :8787 is in-process — do not HTTP-ping it (single-thread deadlock).
    out = [
        PingTarget("workerd", f"http://127.0.0.1:{WORKERD_PORT}/health", required=True),
    ]
    if (os.environ.get("FOG_PING_PUBLIC") or "").strip().lower() in ("1", "true", "yes"):
        pub = (os.environ.get("FOG_PUBLIC_URL") or "https://fog.calhegasmorais.pt/health").strip()
        if not refuse_workers_dev(pub):
            out.append(PingTarget("public", pub, required=False))
    return out
