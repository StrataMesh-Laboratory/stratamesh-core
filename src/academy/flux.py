"""Academy → dual-lobe QIGA flux.

A grade is not a quiz score. It is a bilateral packet:

  probabilistic lobe  — soft fitness from pass rate (Ollama or human answers)
  symbolic lobe       — fail-closed admissibility (unready / workers.dev / grok@)
  bus                 — Propose → Constrain → Commit | Escalate
  QIGA                — only admissible packets breed
  federated           — summaries (fitness, genes, generation). Never answers.

Taps FederatedMetaController (src/orchestrator). No secrets. No workers.dev.
"""

from __future__ import annotations

import math
from typing import Any

from orchestrator.bilateral import Proposal, ProposalKind, AdmissibilityVerdict
from orchestrator.meta_controller import FederatedMetaController
from orchestrator.qiga import Individual
from orchestrator.symbolic import Constraint, SymbolicLobe

from .catalog import FORMATION_GENES, GENE_SLOTS, ROSTER

N_GENES = len(GENE_SLOTS)
STUDENT_IDS = {r["acb_id"] for r in ROSTER}


def fitness_from_grade(grade: dict) -> float:
    if not grade or grade.get("unready") or not grade.get("ok"):
        return 0.0
    total = max(1, int(grade.get("total") or 0))
    passed = int(grade.get("passed") or 0)
    base = passed / total
    if grade.get("mode") == "exploratory":
        return max(0.0, min(1.0, 0.4 + 0.6 * base))
    return max(0.0, min(1.0, 0.5 + 0.5 * base))


def packet_flags(grade: dict, acb_id: str) -> dict:
    violations = []
    for r in grade.get("results") or []:
        violations.extend(r.get("violations") or [])
    workers_dev = any("workers.dev" in str(v) for v in violations)
    return {
        "unready": bool(grade.get("unready") or not grade.get("complete")),
        "workers_dev": workers_dev,
        "not_student": acb_id not in STUDENT_IDS,
        "complete": bool(grade.get("complete")),
        "formation_id": grade.get("formation_id"),
        "passed": grade.get("passed"),
        "total": grade.get("total"),
    }


def _install_academy_constraints(lobe: SymbolicLobe) -> None:
    def unready_fail(p, mem):
        if (p.args or {}).get("unready"):
            return "unready grade is fail-closed — do not evolve"
        return None

    def workers_dev(p, mem):
        if (p.args or {}).get("workers_dev"):
            return "workers.dev is not admissible"
        return None

    def grok_not_student(p, mem):
        if (p.args or {}).get("not_student"):
            return "grok@ / unknown id is not a student"
        return None

    lobe.add_constraint(Constraint("academy_unready", "Unready does not breed", unready_fail, True))
    lobe.add_constraint(Constraint("academy_workers_dev", "No workers.dev", workers_dev, True))
    lobe.add_constraint(Constraint("academy_student", "Roster only", grok_not_student, True))


class AcademyFlux:
    """One controller per process; per-ACB QIGA state on the side."""

    def __init__(self, seed: int = 42):
        self.ctrl = FederatedMetaController(n_genes=N_GENES, population=12, seed=seed)
        _install_academy_constraints(self.ctrl.sym)
        self.states: dict[str, dict[str, Any]] = {}
        self.summaries: dict[str, dict[str, Any]] = {}

    def _state(self, acb_id: str) -> dict[str, Any]:
        if acb_id not in self.states:
            self.states[acb_id] = {
                "acb_id": acb_id,
                "generation": 0,
                "fitness_ema": 0.5,
                "genes": [0.5] * N_GENES,
                "theta": [math.asin(math.sqrt(0.5))] * N_GENES,
                "slots": list(GENE_SLOTS),
            }
        return self.states[acb_id]

    def tick(self, acb_id: str, grade: dict) -> dict[str, Any]:
        acb_id = (acb_id or "").strip().upper()
        flags = packet_flags(grade, acb_id)
        fit = fitness_from_grade(grade)
        st = self._state(acb_id) if acb_id in STUDENT_IDS else None

        prop = Proposal.create(
            ProposalKind.TASK,
            "academy_grade",
            args={**flags, "fitness": fit, "answers_omitted": True},
            confidence=0.92 if flags["complete"] and not flags["unready"] else 0.08,
            expected_utility=fit,
            risk=0.05 if flags["complete"] else 0.9,
        )
        adm = self.ctrl.sym.evaluate(prop, self.ctrl.bus.working_memory)
        rec = self.ctrl.bus.commit(prop, adm)
        committed = rec.committed and adm.verdict == AdmissibilityVerdict.PASS

        evolved = False
        if committed and st is not None:
            self.ctrl.observe_federated(
                [
                    {
                        "task_success_rate": fit,
                        "academy_fitness": fit,
                        "fail_closed_rate": 1.0,
                        "explore_rate": 0.45 if grade.get("mode") == "exploratory" else 0.25,
                        "task_cost": 0.0,
                    }
                ]
            )
            slots = FORMATION_GENES.get(str(grade.get("formation_id") or ""), [1])

            def fitness_fn(ph):
                # Blend live academy packet into the trained alleles
                bonus = 0.0
                for i in slots:
                    if 0 <= i < len(ph):
                        bonus += 0.08 * ph[i]
                return max(0.0, min(1.0, fit * 0.7 + 0.3 * (sum(ph) / max(1, len(ph))) + bonus * 0.1))

            def gene_ok(ind: Individual) -> bool:
                ph = ind.continuous_phenotype()
                if not ph:
                    return False
                avg = sum(ph) / len(ph)
                return 0.05 < avg < 0.95

            self.ctrl.qiga.evaluate(fitness_fn)
            self.ctrl.qiga.mark_admissible(gene_ok)
            best = self.ctrl.qiga.evolve()
            ph = best.continuous_phenotype()
            # Drift the student's trained alleles toward the elite phenotype
            genes = list(st["genes"])
            for i in slots:
                if 0 <= i < N_GENES and i < len(ph):
                    genes[i] = max(0.0, min(1.0, 0.7 * genes[i] + 0.3 * ph[i]))
            st["genes"] = genes
            st["theta"] = [math.asin(math.sqrt(max(0.0, min(1.0, g)))) for g in genes]
            st["generation"] = int(st["generation"]) + 1
            st["fitness_ema"] = 0.85 * float(st["fitness_ema"]) + 0.15 * fit
            st["last_formation"] = grade.get("formation_id")
            evolved = True
            self.summaries[acb_id] = {
                "acb_id": acb_id,
                "fitness": round(fit, 4),
                "fitness_ema": round(float(st["fitness_ema"]), 4),
                "generation": st["generation"],
                "genes": [round(g, 4) for g in st["genes"]],
                "slots": [GENE_SLOTS[i] for i in slots if 0 <= i < N_GENES],
                "federate": True,
                "answers": None,
            }

        return {
            "ok": True,
            "schema": "stratamesh.academy.flux.v1",
            "acb_id": acb_id or None,
            "student": acb_id in STUDENT_IDS,
            "fitness": fit,
            "committed": committed,
            "evolved": evolved,
            "unready": flags["unready"],
            "verdict": adm.verdict.value,
            "reasons": adm.reasons,
            "bus": "propose → constrain → commit | escalate",
            "lobes": {"probabilistic": "fitness packet", "symbolic": "fail-closed certificate"},
            "qiga": None
            if st is None
            else {
                "generation": st["generation"],
                "fitness_ema": round(float(st["fitness_ema"]), 4),
                "genes": [round(g, 4) for g in st["genes"]],
                "slots": GENE_SLOTS,
            },
            "federated_summary": self.summaries.get(acb_id),
            "note": "summaries omit answers; unready does not breed",
        }

    def federated_round(self) -> dict[str, Any]:
        rows = list(self.summaries.values())
        if not rows:
            return {"ok": True, "n": 0, "mean_fitness": None, "clients": []}
        mean = sum(r["fitness_ema"] for r in rows) / len(rows)
        self.ctrl.observe_federated(
            [{"academy_fitness": r["fitness_ema"], "task_success_rate": r["fitness_ema"]} for r in rows]
        )
        return {
            "ok": True,
            "n": len(rows),
            "mean_fitness": round(mean, 4),
            "clients": rows,
            "raw_answers": False,
        }
