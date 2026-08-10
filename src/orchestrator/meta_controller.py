"""
Federated Meta-Controller
=========================
Outer loop that owns the bilateral bus, both lobes, and QIGA.
Runs one decision tick: observe → propose → constrain → commit/escalate → evolve.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from .bilateral import BilateralBus, Proposal, ProposalKind, AdmissibilityVerdict
from .probabilistic import ProbabilisticLobe
from .symbolic import SymbolicLobe
from .qiga import QIGAPopulation, Individual


class FederatedMetaController:
    """
    Hybrid Orchestrator core.
    Probabilistic and symbolic lobes are co-equal from construction.
    """

    def __init__(self, n_genes: int = 8, population: int = 16, seed: int = 42):
        self.bus = BilateralBus()
        self.prob = ProbabilisticLobe(seed=seed)
        self.sym = SymbolicLobe()
        self.qiga = QIGAPopulation(n_individuals=population, n_genes=n_genes, seed=seed)
        self.tick_count = 0

    def observe_federated(self, node_summaries: List[Dict[str, float]]):
        """
        Ingest SPA-gated summaries from Fog/Edge nodes.
        Each summary is a flat metric dict (no raw payloads).
        """
        if not node_summaries:
            return
        # Simple federated average (Phase H1 — later: weighted by SPA trust / contribution)
        keys = set()
        for s in node_summaries:
            keys.update(s.keys())
        agg = {}
        for k in keys:
            vals = [s[k] for s in node_summaries if k in s]
            if vals:
                agg[k] = sum(vals) / len(vals)
        self.prob.observe(agg)
        self.bus.update_memory(metrics=agg)

    def _fitness_from_gene(self, gene: List[float]) -> float:
        """
        Toy multi-objective fitness:
        - prefer moderate exploration (gene[0])
        - prefer high believed task success
        - penalise extreme risk genes
        """
        success = self.prob.belief_mean("task_success_rate", 0.5)
        cost = self.prob.belief_mean("task_cost", 0.2)
        explore = gene[0] if gene else 0.5
        fitness = success - 0.3 * cost - 0.2 * abs(explore - 0.4)
        return max(0.0, min(1.0, fitness))

    def tick(self, extra_proposals: Optional[List[Proposal]] = None) -> Dict[str, Any]:
        """
        One full bilateral cycle + optional QIGA generation.
        """
        self.tick_count += 1
        proposals: List[Proposal] = []

        # Probabilistic lobe: task proposals from beliefs
        proposals.append(self.prob.propose_task(
            "rebalance_tip_selection",
            args={"explore": self.prob.belief_mean("explore_rate", 0.3)},
        ))
        proposals.append(self.prob.propose_task(
            "pin_priority_refresh",
            args={"max_pins": 16},
        ))

        # QIGA: evaluate population, mark admissibility via symbolic proxy, evolve
        self.qiga.evaluate(self._fitness_from_gene)

        def gene_admissible(ind: Individual) -> bool:
            # Symbolic filter: reject extreme all-zero or all-one phenotypes as degenerate
            ph = ind.continuous_phenotype()
            if not ph:
                return False
            avg = sum(ph) / len(ph)
            return 0.05 < avg < 0.95

        self.qiga.mark_admissible(gene_admissible)
        best = self.qiga.evolve()
        policy_prop = self.prob.propose_policy(
            "qiga_policy_candidate",
            gene_vector=best.continuous_phenotype(),
            fitness=best.fitness,
        )
        proposals.append(policy_prop)

        if extra_proposals:
            proposals.extend(extra_proposals)

        ranked = self.prob.rank(proposals)
        results = []
        for prop in ranked:
            adm = self.sym.evaluate(prop, self.bus.working_memory)
            rec = self.bus.commit(prop, adm)
            results.append({
                "proposal": prop.action,
                "confidence": prop.confidence,
                "verdict": adm.verdict.value,
                "committed": rec.committed,
                "reasons": adm.reasons,
                "escalate": adm.escalate,
            })

        return {
            "tick": self.tick_count,
            "generation": self.qiga.generation,
            "best_fitness": best.fitness,
            "decisions": results,
            "metrics": dict(self.bus.working_memory.get("metrics") or {}),
            "escalations": list(self.bus.working_memory.get("escalations") or []),
        }


def demo():
    """Runnable self-check for the hybrid Orchestrator."""
    ctrl = FederatedMetaController(n_genes=6, population=12, seed=7)
    # Simulated federated summaries from three Fog nodes
    summaries = [
        {"task_success_rate": 0.72, "task_cost": 0.18, "explore_rate": 0.35},
        {"task_success_rate": 0.65, "task_cost": 0.22, "explore_rate": 0.40},
        {"task_success_rate": 0.80, "task_cost": 0.15, "explore_rate": 0.28},
    ]
    ctrl.observe_federated(summaries)
    out = ctrl.tick()
    print("=== Federated Meta-Controller tick ===")
    print(f"tick={out['tick']}  QIGA generation={out['generation']}  best_fitness={out['best_fitness']:.3f}")
    for d in out["decisions"]:
        print(f"  {d['proposal']}: verdict={d['verdict']} committed={d['committed']} conf={d['confidence']:.2f}")
        if d["reasons"]:
            print(f"    reasons: {d['reasons'][:2]}")
    # Irreversible proposal → must escalate
    from .bilateral import Proposal, ProposalKind
    bad = Proposal.create(ProposalKind.PARAM, "token_emission_change", confidence=0.9, args={})
    out2 = ctrl.tick(extra_proposals=[bad])
    print("\nIrreversible action test:")
    for d in out2["decisions"]:
        if d["proposal"] == "token_emission_change":
            print(f"  verdict={d['verdict']} escalate={d['escalate']} committed={d['committed']}")
            print(f"  reasons={d['reasons']}")
    print("\nHybrid Orchestrator demo OK.")


if __name__ == "__main__":
    demo()
