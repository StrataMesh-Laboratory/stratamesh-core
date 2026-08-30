"""Quantity × quality keep-up stream.

Quantity is uptime, ping success, residual capacity.
Quality gates: honesty, continuity, fail-closed, hop health.
Score = quantity * quality. Unready samples do not contribute.
"""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional

from .ping import PingPlugin, PingResult

SCHEMA = "stratamesh.fog.keepup.v1"
DATA = Path(os.environ.get("FOG_DATA") or "/workspace/data/fog")
STREAM = DATA / "keepup.jsonl"
POLL_SEC = float(os.environ.get("FOG_KEEPUP_SEC") or "15")
WINDOW = 20


@dataclass
class KeepUpSample:
    ts: float
    node_id: str
    quantity: float
    quality: float
    score: float
    admissible: bool
    unready: bool
    factors: dict
    ping: dict
    rails: dict


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


class KeepUpPlugin:
    def __init__(self, node_id: str, ping: Optional[PingPlugin] = None, mesh_flags=None, resource_sample=None):
        self.node_id = node_id
        self.ping = ping or PingPlugin()
        self._mesh_flags = mesh_flags
        self._resource_sample = resource_sample
        self.on_sample = None
        self.samples: List[KeepUpSample] = []
        self.missed = 0
        self.lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = None
        self.started_at = time.time()

    def _flags(self) -> dict:
        if callable(self._mesh_flags):
            try:
                return dict(self._mesh_flags() or {})
            except Exception:
                return {}
        return dict(self._mesh_flags or {})

    def _residual(self) -> float:
        if not callable(self._resource_sample):
            return 0.5
        try:
            s = self._resource_sample()
            cpu = float(getattr(s, "cpu_percent", 50.0) or 50.0)
            return _clamp(1.0 - cpu / 100.0)
        except Exception:
            return 0.5

    def _quality(self, results: List[PingResult], flags: dict) -> tuple[float, dict, bool]:
        required = [r for r in results if r.name != "public"]
        unready = any(r.unready or not r.ok for r in required) if required else True
        hop_ok = 1.0 if any(r.name == "workerd" and r.ok for r in results) else 0.0
        fog_ok = 1.0 if any(r.name == "fog" and r.ok for r in results) else (0.6 if not unready else 0.0)
        # in-process Fog is the measurer; workerd hop is the public path
        n = int(flags.get("n") or 0)
        f_max = (flags.get("mesh_provision") or {}).get("f_max")
        if f_max is None:
            f_max = flags.get("f_max")
        honesty = 1.0
        if n == 2 and f_max not in (0, "0", None):
            honesty = 0.0
        if flags.get("oracle_live") is True:
            honesty *= 0.5  # lab must not claim oracle_live
        if any("workers.dev" in (r.url or "") for r in results):
            honesty = 0.0
        continuity = 1.0 if self.missed < 3 else _clamp(1.0 - (self.missed - 2) * 0.2)
        fail_closed = 0.0 if unready else 1.0
        parts = {
            "honesty": round(honesty, 4),
            "continuity": round(continuity, 4),
            "fail_closed": round(fail_closed, 4),
            "hop_ok": round(hop_ok, 4),
            "fog_ok": round(fog_ok, 4),
        }
        # quality is a gate: geometric-ish mean of the hard parts
        hard = [honesty, fail_closed, continuity]
        if any(v <= 0 for v in hard):
            q = 0.0
        else:
            q = (honesty * fail_closed * continuity * (0.5 + 0.5 * hop_ok)) ** 0.5
            q = _clamp(q)
        return q, parts, unready

    def _quantity(self, results: List[PingResult], residual: float) -> float:
        snap = self.ping.snapshot()
        uptime = min(1.0, snap["uptime_s"] / 3600.0)  # saturates at 1h window
        ok_ratio = float(snap.get("ok_ratio") or 0.0)
        rtt = float(snap.get("rtt_ema_ms") or 0.0)
        rtt_score = 1.0 if rtt <= 0 else _clamp(1.0 - (rtt / 800.0))
        required_ok = all(r.ok for r in results if r.name != "public") if results else False
        if not required_ok:
            return 0.0
        return _clamp(0.35 * ok_ratio + 0.25 * uptime + 0.20 * residual + 0.20 * rtt_score)

    def measure(self) -> KeepUpSample:
        results = list(self.ping.tick())
        # In-process Fog is the measurer — always ready if this thread runs.
        fog = PingResult("fog", "in-process", True, 200, 0.0, False, None)
        self.ping._remember(fog)
        results.append(fog)
        flags = self._flags()
        residual = self._residual()
        quality, factors, unready = self._quality(results, flags)
        if unready:
            self.missed += 1
        else:
            self.missed = 0
        quantity = 0.0 if unready else self._quantity(results, residual)
        admissible = (not unready) and quality > 0 and quantity > 0
        score = round(quantity * quality, 6) if admissible else 0.0
        sample = KeepUpSample(
            ts=time.time(),
            node_id=self.node_id,
            quantity=round(quantity, 6),
            quality=round(quality, 6),
            score=score,
            admissible=admissible,
            unready=unready,
            factors=factors,
            ping={r.name: {"ok": r.ok, "rtt_ms": round(r.rtt_ms, 2), "unready": r.unready} for r in results},
            rails={"mint_armed": False, "burn_armed": False, "oracle_live": False, "lab_waived": True},
        )
        with self.lock:
            self.samples.append(sample)
            if len(self.samples) > 200:
                self.samples = self.samples[-200:]
            self._append(sample)
        if callable(self.on_sample):
            try:
                self.on_sample(sample)
            except Exception:
                pass
        return sample

    def _append(self, sample: KeepUpSample) -> None:
        try:
            DATA.mkdir(parents=True, exist_ok=True)
            with STREAM.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps({"schema": SCHEMA, **asdict(sample)}, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def snapshot(self) -> dict:
        with self.lock:
            last = self.samples[-1] if self.samples else None
            window = self.samples[-WINDOW:]
        scores = [s.score for s in window]
        mean = (sum(scores) / len(scores)) if scores else 0.0
        return {
            "schema": SCHEMA,
            "plugin": "fog-keepup",
            "node_id": self.node_id,
            "ok": bool(last and last.admissible),
            "last": asdict(last) if last else None,
            "window_n": len(window),
            "score_ema": round(mean, 6),
            "quantity_sum": round(sum(s.quantity for s in window), 6),
            "quality_mean": round((sum(s.quality for s in window) / len(window)) if window else 0.0, 6),
            "admissible_n": sum(1 for s in window if s.admissible),
            "unready_n": sum(1 for s in window if s.unready),
            "ping": self.ping.snapshot(),
            "stream": str(STREAM),
            "note": "quantity × quality. Unready does not contribute. STRATA rails unarmed.",
        }

    def stream_tail(self, n: int = 20) -> list:
        with self.lock:
            return [asdict(s) for s in self.samples[-n:]]

    def _loop(self) -> None:
        self.measure()
        while not self._stop.wait(POLL_SEC):
            try:
                self.measure()
            except Exception:
                self.missed += 1

    def attach(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._loop, name="fog-keepup", daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        self._stop.set()
