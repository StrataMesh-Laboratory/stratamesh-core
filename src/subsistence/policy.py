"""
Subsistence pressure policy — maps deficit to recommended actions.
Substrate-neutral; SPAs may override thresholds.
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
from .ledger import AgentAccount


class PressureAction(Enum):
    NONE = "none"
    OPTIMIZE = "optimize"
    HIBERNATE = "hibernate"
    MIGRATE = "migrate"
    EVOLVE = "evolve"
    EXIT = "exit"


@dataclass
class SubsistencePolicy:
    """
    Decision thresholds on surplus relative to tau.
    deficit = tau - surplus (positive when insolvent).
    """
    optimize_below: float = 0.0       # any deficit
    hibernate_below: float = -10.0    # deeper deficit
    migrate_below: float = -25.0
    evolve_below: float = -40.0
    exit_below: float = -80.0
    max_grace_ticks: int = 3

    def recommend(self, acc: AgentAccount) -> PressureAction:
        surplus = acc.last_surplus
        deficit = acc.tau - surplus

        if surplus >= acc.tau:
            acc.grace_remaining = self.max_grace_ticks
            if acc.status == "hibernating":
                return PressureAction.OPTIMIZE  # wake path left to runtime
            return PressureAction.NONE

        # Insolvent
        if acc.grace_remaining > 0:
            acc.grace_remaining -= 1
            return PressureAction.OPTIMIZE

        if deficit >= abs(self.exit_below) or surplus <= self.exit_below:
            return PressureAction.EXIT
        if surplus <= self.evolve_below:
            return PressureAction.EVOLVE
        if surplus <= self.migrate_below:
            return PressureAction.MIGRATE
        if surplus <= self.hibernate_below:
            return PressureAction.HIBERNATE
        return PressureAction.OPTIMIZE

    def apply_status(self, acc: AgentAccount, action: PressureAction):
        mapping = {
            PressureAction.NONE: "active",
            PressureAction.OPTIMIZE: "active",
            PressureAction.HIBERNATE: "hibernating",
            PressureAction.MIGRATE: "migrating",
            PressureAction.EVOLVE: "evolving",
            PressureAction.EXIT: "exited",
        }
        acc.status = mapping.get(action, acc.status)
