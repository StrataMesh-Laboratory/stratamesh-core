"""
Resource metering for Proof of Subsistence.
Units are abstract and substrate-neutral; SPAs map them to real costs.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict
import time


@dataclass
class ResourceVector:
    """Consumption or earning components over a period."""
    compute: float = 0.0      # abstract compute-units
    memory_time: float = 0.0  # memory-units × time
    bandwidth: float = 0.0    # data transfer units
    energy: float = 0.0       # energy proxy units
    other: float = 0.0

    def total(self, weights: Dict[str, float] | None = None) -> float:
        w = weights or {
            "compute": 1.0,
            "memory_time": 1.0,
            "bandwidth": 0.5,
            "energy": 1.2,
            "other": 1.0,
        }
        return (
            w.get("compute", 1.0) * self.compute
            + w.get("memory_time", 1.0) * self.memory_time
            + w.get("bandwidth", 0.5) * self.bandwidth
            + w.get("energy", 1.2) * self.energy
            + w.get("other", 1.0) * self.other
        )

    def __add__(self, other: "ResourceVector") -> "ResourceVector":
        return ResourceVector(
            compute=self.compute + other.compute,
            memory_time=self.memory_time + other.memory_time,
            bandwidth=self.bandwidth + other.bandwidth,
            energy=self.energy + other.energy,
            other=self.other + other.other,
        )

    def scale(self, k: float) -> "ResourceVector":
        return ResourceVector(
            compute=self.compute * k,
            memory_time=self.memory_time * k,
            bandwidth=self.bandwidth * k,
            energy=self.energy * k,
            other=self.other * k,
        )


@dataclass
class ResourceMeter:
    """Accumulates consumption for one agent."""
    agent_id: str
    window_start: float = field(default_factory=time.time)
    consumed: ResourceVector = field(default_factory=ResourceVector)
    earned: ResourceVector = field(default_factory=ResourceVector)

    def record_consume(self, **kwargs):
        self.consumed = self.consumed + ResourceVector(**kwargs)

    def record_earn(self, **kwargs):
        self.earned = self.earned + ResourceVector(**kwargs)

    def snapshot(self, weights: Dict[str, float] | None = None) -> dict:
        c = self.consumed.total(weights)
        e = self.earned.total(weights)
        return {
            "agent_id": self.agent_id,
            "window_start": self.window_start,
            "consumed_total": c,
            "earned_total": e,
            "consumed": self.consumed.__dict__,
            "earned": self.earned.__dict__,
        }

    def reset_window(self):
        self.window_start = time.time()
        self.consumed = ResourceVector()
        self.earned = ResourceVector()
