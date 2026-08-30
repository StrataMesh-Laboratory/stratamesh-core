"""Mac Fog runtime plugins.

Ping the hop. Measure contribution keep-up (quantity × quality).
STRATA #mint / #0 rails exist but stay unarmed while oracle_live=false.
"""

from .ping import PingPlugin, PingTarget, refuse_workers_dev
from .keepup import KeepUpPlugin, KeepUpSample
from .rails import RailsPlug

SCHEMA = "stratamesh.fog.keepup.v1"

__all__ = [
    "SCHEMA",
    "PingPlugin",
    "PingTarget",
    "refuse_workers_dev",
    "KeepUpPlugin",
    "KeepUpSample",
    "RailsPlug",
]
