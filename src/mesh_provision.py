"""Mesh membership gates. Generic Fog Nodes start n=1 until they peer."""
from __future__ import annotations

import os

FOG_ID = "FOG-NODE-PT-CM-001"
EDGE_ID = "EDGE-GROK-CMN-001"
N_MIN_MEMBER = 2
N_MIN_BYZANTINE = 3


def _profile() -> dict:
    try:
        from fog_profile import load
        return load()
    except Exception:
        return {}


def origin_role() -> str:
    p = _profile()
    return (os.environ.get("FOG_ORIGIN") or p.get("origin") or "").strip() or "session"


def this_node_id() -> str:
    p = _profile()
    return (os.environ.get("FOG_NODE_ID") or p.get("node_id") or FOG_ID).strip()


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
    nid = this_node_id()
    cmn = nid == FOG_ID
    peers = [
        {
            "id": nid,
            "role": "fog",
            "continuity": "continuous" if live or role == "local" else "session",
            "origin": role,
        }
    ]
    if cmn and n >= 2:
        peers.append(
            {
                "id": EDGE_ID,
                "role": "edge",
                "continuity": "session",
                "origin": "edge-grok-local",
                "note": "non-continuous expected (EDGE)",
            }
        )
    return {
        "mac_live": live,
        "trusted": live or role in ("edge", "local", "macbook"),
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
            "peers": peers,
            "next": "n>=3 → f_max>0" if member else "second distinct host_id → mesh_member=true",
        },
    }
