"""Proof of Subsistence mechanics."""

from .meter import ResourceMeter, ResourceVector
from .ledger import SubsistenceLedger, AgentAccount
from .policy import SubsistencePolicy, PressureAction
from .runtime import SubsistenceRuntime
from .metabolism_opt import opted_in, remaining_for, verdict_to_action, gate_spend

__all__ = [
    "ResourceMeter",
    "ResourceVector",
    "SubsistenceLedger",
    "AgentAccount",
    "SubsistencePolicy",
    "PressureAction",
    "SubsistenceRuntime",
    "opted_in",
    "remaining_for",
    "verdict_to_action",
    "gate_spend",
]
