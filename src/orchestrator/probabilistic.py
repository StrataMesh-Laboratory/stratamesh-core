"""
Probabilistic Lobe
==================
Belief state, soft ranking, and fitness estimation.
Hosts QIGA population scoring (does not own constraint logic).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import math
import random
import time
from .bilateral import Proposal, ProposalKind


@dataclass
class Belief:
    name: str
    mean: float = 0.0
    variance: float = 1.0
    n: int = 0

    def update(self, observation: float, strength: float = 1.0):
        # Simple Bayesian-ish running estimate
        self.n += 1
        lr = strength / (self.n + 1)
        delta = observation - self.mean
        self.mean += lr * delta
        self.variance = (1 - lr) * self.variance + lr * (delta ** 2)


class ProbabilisticLobe:
    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.beliefs: Dict[str, Belief] = {}
        self.last_metrics: Dict[str, float] = {}

    def observe(self, metrics: Dict[str, float]):
        self.last_metrics = dict(metrics)
        for k, v in metrics.items():
            if k not in self.beliefs:
                self.beliefs[k] = Belief(name=k)
            self.beliefs[k].update(float(v))

    def belief_mean(self, name: str, default: float = 0.0) -> float:
        b = self.beliefs.get(name)
        return b.mean if b else default

    def uncertainty(self, name: str) -> float:
        b = self.beliefs.get(name)
        if not b or b.n < 2:
            return 1.0
        return math.sqrt(max(b.variance, 1e-9))

    def propose_task(self, action: str, **args) -> Proposal:
        # Confidence rises with lower uncertainty on related metrics
        conf = 1.0 / (1.0 + self.uncertainty("task_success_rate"))
        util = self.belief_mean("task_success_rate", 0.5) - 0.1 * self.belief_mean("task_cost", 0.2)
        risk = self.uncertainty("task_success_rate")
        return Proposal.create(
            ProposalKind.TASK,
            action,
            args=args,
            confidence=max(0.05, min(0.99, conf)),
            expected_utility=util,
            risk=risk,
        )

    def propose_policy(self, action: str, gene_vector: List[float], fitness: float) -> Proposal:
        conf = 1.0 / (1.0 + abs(1.0 - fitness))
        return Proposal.create(
            ProposalKind.POLICY,
            action,
            args={"gene": gene_vector, "fitness": fitness},
            confidence=max(0.05, min(0.99, conf)),
            expected_utility=fitness,
            risk=1.0 - conf,
        )

    def rank(self, proposals: List[Proposal]) -> List[Proposal]:
        def score(p: Proposal) -> float:
            return p.expected_utility * p.confidence - 0.5 * p.risk
        return sorted(proposals, key=score, reverse=True)
