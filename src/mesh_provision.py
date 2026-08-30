"""Mesh membership gates.

n=1  → mesh_member false (one host_id)
n=2  → mesh_member true when Fog Mac and EDGE-GROK are distinct hosts
       EDGE continuity may be session (expected). f_max still 0 until n>=3.
Equal host_ids still forbid mesh_member (see host_fingerprint).
"""
from __future__ import annotations

import os

FOG_ID = "FOG-NODE-PT-CM-001"
EDGE_ID = "EDGE-GROK-CMN-001"
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


def mesh_n() -> int:
    raw = (os.environ.get("FOG_MESH_N") or "").strip()
    if raw.isdigit():
        return max(1, int(raw))
    if mac_live() or origin_role() in ("macbook", "edge"):
        return 2
    return 1


def flags() -> dict:
    live = mac_live()
    role = origin_role()
    n = mesh_n()
    member = n >= N_MIN_MEMBER
    f_max = 0 if n < N_MIN_BYZANTINE else 1
    return {
        "mac_live": live,
        "trusted": live or role == "edge",
        "mesh_member": member,
        "oracle_live": False,
        "n": n,
        "mesh_provision": {
            "ready": True,
            "mesh_member": member,
            "n": n,
            "f_max": f_max,
            "n_min_member": N_MIN_MEMBER,
            "n_min_byzantine": N_MIN_BYZANTINE,
            "runtime": "workerd" if role != "edge" else "edge-grok-local",
            "serverless_hop": role != "edge",
            "trusted_origin": "macbook" if live else role,
            "peers": [
                {
                    "id": FOG_ID,
                    "role": "fog",
                    "continuity": "continuous",
                    "origin": "macbook",
                },
                {
                    "id": EDGE_ID,
                    "role": "edge",
                    "continuity": "session",
                    "origin": "edge-grok-local",
                    "note": "non-continuous expected (EDGE)",
                },
            ],
            "next": "n>=3 → f_max>0" if member else "second distinct host_id → mesh_member=true",
        },
    }
