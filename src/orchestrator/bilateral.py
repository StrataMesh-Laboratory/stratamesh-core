"""
Bilateral Integration Bus
=========================
Shared protocol between probabilistic and symbolic lobes.
Neither lobe may unilaterally commit high-stakes actions.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import time
import uuid


class ProposalKind(Enum):
    TASK = "task"
    POLICY = "policy"
    PARAM = "param"
    ESCALATION = "escalation"


@dataclass
class Proposal:
    """Soft proposal emitted by the probabilistic lobe."""
    id: str
    kind: ProposalKind
    action: str
    args: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.5          # [0, 1]
    expected_utility: float = 0.0
    risk: float = 0.0
    origin: str = "probabilistic"
    created_at: float = field(default_factory=time.time)

    @staticmethod
    def create(kind: ProposalKind, action: str, **kwargs) -> "Proposal":
        return Proposal(
            id=str(uuid.uuid4())[:12],
            kind=kind,
            action=action,
            args=kwargs.get("args", {}),
            confidence=kwargs.get("confidence", 0.5),
            expected_utility=kwargs.get("expected_utility", 0.0),
            risk=kwargs.get("risk", 0.0),
        )


class AdmissibilityVerdict(Enum):
    PASS = "pass"
    FAIL = "fail"
    CONDITIONAL = "conditional"  # requires human / further constraints


@dataclass
class Admissibility:
    """Symbolic lobe verdict on a proposal."""
    proposal_id: str
    verdict: AdmissibilityVerdict
    reasons: List[str] = field(default_factory=list)
    required_constraints: List[str] = field(default_factory=list)
    escalate: bool = False
    certificate_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])


@dataclass
class DecisionRecord:
    proposal: Proposal
    admissibility: Admissibility
    committed: bool
    timestamp: float = field(default_factory=time.time)
    notes: str = ""


class BilateralBus:
    """
    Propose → Constrain → Revise → Commit | Escalate
    """

    def __init__(self):
        self.history: List[DecisionRecord] = []
        self.working_memory: Dict[str, Any] = {
            "goals": [],
            "active_spas": [],
            "metrics": {},
            "escalations": [],
        }

    def update_memory(self, **kwargs):
        self.working_memory.update(kwargs)

    def commit(self, proposal: Proposal, admissibility: Admissibility, notes: str = "") -> DecisionRecord:
        committed = (
            admissibility.verdict == AdmissibilityVerdict.PASS
            and not admissibility.escalate
        )
        if admissibility.verdict == AdmissibilityVerdict.CONDITIONAL and admissibility.escalate:
            committed = False
            self.working_memory.setdefault("escalations", []).append({
                "proposal_id": proposal.id,
                "reasons": admissibility.reasons,
            })
        rec = DecisionRecord(
            proposal=proposal,
            admissibility=admissibility,
            committed=committed,
            notes=notes,
        )
        self.history.append(rec)
        return rec

    def recent(self, n: int = 10) -> List[DecisionRecord]:
        return self.history[-n:]
