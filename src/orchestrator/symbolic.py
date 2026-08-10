"""
Symbolic Lobe
=============
Constraint store, SPA/DAO rules, admissibility certificates.
Does not invent soft rankings — only admits, rejects, or conditions them.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
from .bilateral import (
    Proposal,
    ProposalKind,
    Admissibility,
    AdmissibilityVerdict,
)


@dataclass
class Constraint:
    name: str
    description: str
    check: Callable[[Proposal, Dict[str, Any]], Optional[str]]
    # check returns None if OK, or a reason string if violated
    hard: bool = True  # hard → FAIL; soft → CONDITIONAL


class SymbolicLobe:
    def __init__(self):
        self.constraints: List[Constraint] = []
        self._install_defaults()

    def _install_defaults(self):
        def no_empty_action(p: Proposal, mem: Dict) -> Optional[str]:
            if not p.action or not p.action.strip():
                return "empty action"
            return None

        def confidence_floor(p: Proposal, mem: Dict) -> Optional[str]:
            if p.kind != ProposalKind.ESCALATION and p.confidence < 0.15:
                return f"confidence {p.confidence:.2f} below floor 0.15"
            return None

        def high_risk_escalation(p: Proposal, mem: Dict) -> Optional[str]:
            if p.risk >= 0.85 and p.kind != ProposalKind.ESCALATION:
                return "risk >= 0.85 requires escalation path"
            return None

        def spa_aware_policy(p: Proposal, mem: Dict) -> Optional[str]:
            if p.kind == ProposalKind.POLICY and p.action.startswith("network_wide_"):
                spas = mem.get("active_spas") or []
                if not spas:
                    return "network-wide policy requires at least one active SPA"
            return None

        def irreversible_guard(p: Proposal, mem: Dict) -> Optional[str]:
            # Substrate-neutral: irreversible acts require a constitutionally
            # designated escalator class (any qualified agents), not a human.
            irreversible = {"genesis_param_change", "token_emission_change", "dao_constitution_edit"}
            if p.action in irreversible:
                escalators = mem.get("escalator_class") or []
                if not escalators:
                    return (
                        f"irreversible action '{p.action}' requires a designated "
                        "escalator class in working memory (SPA/DAO-defined; substrate-neutral)"
                    )
                # If escalators exist, still force escalation path rather than auto-commit
                return (
                    f"irreversible action '{p.action}' must be approved by escalator_class={escalators}"
                )
            return None

        def substrate_neutrality(p: Proposal, mem: Dict) -> Optional[str]:
            # Reject proposals that explicitly deny standing by substrate
            args = p.args or {}
            if args.get("require_biological") is True:
                return "substrate chauvinism: require_biological is not an admissible global constraint"
            if args.get("deny_computational_agents") is True:
                return "substrate chauvinism: deny_computational_agents violates epistemic ontology"
            return None

        self.constraints.extend([
            Constraint("no_empty_action", "Action must be non-empty", no_empty_action, hard=True),
            Constraint("confidence_floor", "Minimum confidence for auto-commit", confidence_floor, hard=True),
            Constraint("high_risk_escalation", "High risk must escalate", high_risk_escalation, hard=False),
            Constraint("spa_aware_policy", "Network policies need SPA context", spa_aware_policy, hard=True),
            Constraint("irreversible_guard", "Irreversible acts need designated escalator class", irreversible_guard, hard=True),
            Constraint("substrate_neutrality", "No standing denial by substrate", substrate_neutrality, hard=True),
        ])

    def add_constraint(self, c: Constraint):
        self.constraints.append(c)

    def evaluate(self, proposal: Proposal, working_memory: Dict[str, Any]) -> Admissibility:
        reasons: List[str] = []
        required: List[str] = []
        hard_fail = False
        soft_fail = False

        for c in self.constraints:
            reason = c.check(proposal, working_memory)
            if reason:
                reasons.append(f"{c.name}: {reason}")
                if c.hard:
                    hard_fail = True
                else:
                    soft_fail = True
                    required.append(c.name)

        if hard_fail:
            escalate = any(
                key in r
                for r in reasons
                for key in ("escalation", "irreversible", "escalator_class")
            )
            return Admissibility(
                proposal_id=proposal.id,
                verdict=AdmissibilityVerdict.FAIL,
                reasons=reasons,
                required_constraints=required,
                escalate=escalate or soft_fail,
            )
        if soft_fail:
            return Admissibility(
                proposal_id=proposal.id,
                verdict=AdmissibilityVerdict.CONDITIONAL,
                reasons=reasons,
                required_constraints=required,
                escalate=True,
            )
        return Admissibility(
            proposal_id=proposal.id,
            verdict=AdmissibilityVerdict.PASS,
            reasons=["all constraints satisfied"],
        )
