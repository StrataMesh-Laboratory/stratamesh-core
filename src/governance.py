"""
StrataMesh Governance — Phase 5 scaffold
========================================
DAO proposals + votes as local ledger with optional DAG anchors.
Substrate-neutral: any agent with standing may propose/vote under SPA rules later.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum
import time
import hashlib


class ProposalStatus(Enum):
    OPEN = "open"
    PASSED = "passed"
    REJECTED = "rejected"
    EXECUTED = "executed"


@dataclass
class Proposal:
    proposal_id: str
    author: str
    title: str
    body: str
    status: ProposalStatus = ProposalStatus.OPEN
    yes: float = 0.0
    no: float = 0.0
    voters: Dict[str, str] = field(default_factory=dict)  # agent -> yes|no
    created_at: float = field(default_factory=time.time)
    dag_tx: Optional[str] = None
    threshold: float = 0.5  # yes / (yes+no)

    def tally(self):
        total = self.yes + self.no
        if total <= 0:
            return
        # Require at least 2 distinct voters before auto-close (lab quorum)
        if len(self.voters) < 2:
            return
        if self.yes / total >= self.threshold:
            self.status = ProposalStatus.PASSED
        elif self.no / total > (1 - self.threshold):
            self.status = ProposalStatus.REJECTED


class Governance:
    def __init__(self):
        self.proposals: Dict[str, Proposal] = {}

    def _id(self, author: str, title: str) -> str:
        raw = f"{author}|{title}|{time.time()}"
        return "prop_" + hashlib.sha256(raw.encode()).hexdigest()[:12]

    def propose(self, author: str, title: str, body: str = "") -> Proposal:
        p = Proposal(
            proposal_id=self._id(author, title),
            author=author,
            title=title,
            body=body,
        )
        self.proposals[p.proposal_id] = p
        return p

    def vote(self, proposal_id: str, agent_id: str, choice: str, weight: float = 1.0) -> Proposal:
        p = self.proposals[proposal_id]
        if p.status != ProposalStatus.OPEN:
            raise ValueError("proposal not open")
        choice = choice.lower()
        if choice not in ("yes", "no"):
            raise ValueError("choice must be yes|no")
        if agent_id in p.voters:
            raise ValueError("already voted")
        p.voters[agent_id] = choice
        if choice == "yes":
            p.yes += weight
        else:
            p.no += weight
        p.tally()
        return p

    def summary(self) -> dict:
        return {
            "total": len(self.proposals),
            "open": sum(1 for p in self.proposals.values() if p.status == ProposalStatus.OPEN),
            "proposals": [
                {
                    "id": p.proposal_id,
                    "title": p.title,
                    "author": p.author,
                    "status": p.status.value,
                    "yes": p.yes,
                    "no": p.no,
                    "dag_tx": p.dag_tx,
                }
                for p in list(self.proposals.values())[-30:]
            ],
        }


def demo():
    g = Governance()
    p = g.propose("FOG-NODE-PT-CM-001", "Raise pin SLA", "Increase pin success target to 99.5%")
    g.vote(p.proposal_id, "FOG-NODE-PT-CM-001", "yes", 2.0)
    g.vote(p.proposal_id, "EDGE-02", "no", 1.0)
    print(g.summary())
    assert g.proposals[p.proposal_id].status.value == "passed"
    print("governance demo OK")


if __name__ == "__main__":
    demo()
