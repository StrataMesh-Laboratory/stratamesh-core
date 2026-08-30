"""ACB Academy — always-on formations for Orchestrator + AIOps.

Corrective drills lock known failure modes (fail-closed).
Exploratory drills widen competence without inventing handlers.
Runtime: symbolic (Worker, $0 CF inference) or Ollama←HF GGUF on Fog residual C_mesh.
STRATA cost is declared; lab_waived until oracle_live && funded. Never mint.
"""

from .catalog import FORMATIONS, MODELS, ROSTER, COST, FLUX, syllabus, formation
from .grader import grade
from .ollama_hf import OllamaHf, RuntimeUnavailable
from .flux import AcademyFlux, fitness_from_grade

__all__ = [
    "FORMATIONS",
    "MODELS",
    "ROSTER",
    "COST",
    "FLUX",
    "syllabus",
    "formation",
    "grade",
    "OllamaHf",
    "RuntimeUnavailable",
    "AcademyFlux",
    "fitness_from_grade",
]
