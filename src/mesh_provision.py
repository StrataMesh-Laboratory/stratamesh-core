"""Mesh membership gates. mac_live is not mesh_member.

Lab honesty: mesh_member stays false while n=1 (one host_id).
Mac is the trusted public origin (workerd serverless hop) → mac_live=true.
Member flips only when a second distinct host_id joins.
"""
from __future__ import annotations

import os

N = 1
N_MIN_MEMBER = 2
N_MIN_BYZANTINE = 3


def origin_role() -> str:
    return (os.environ.get("FOG_ORIGIN") or "").strip() or "session"


def mac_live() -> bool:
    v = (os.environ.get("FOG_MAC_LIVE") or "").strip().lower()
    if v in ("1", "true", "yes"):
        return True
    if v in ("0", "false", "no"):
        return False
    return origin_role() == "macbook"


def flags() -> dict:
    live = mac_live()
    role = origin_role()
    return {
        "mac_live": live,
        "trusted": live,
        "mesh_member": False,
        "oracle_live": False,
        "n": N,
        "mesh_provision": {
            "ready": live,
            "mesh_member": False,
            "reason": "n=1; mesh_member requires a second distinct host_id",
            "n_min_member": N_MIN_MEMBER,
            "n_min_byzantine": N_MIN_BYZANTINE,
            "runtime": "workerd",
            "serverless_hop": True,
            "trusted_origin": "macbook" if live else role,
            "next": "second distinct host_id → mesh_member=true; n>=3 → f_max>0",
        },
    }
