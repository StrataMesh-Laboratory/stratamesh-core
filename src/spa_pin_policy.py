"""
SPA pinner-role policy
======================
Nodes advertising the "pinner" role should operate IPFS in api mode
(or explicitly acknowledge stub for lab only).
"""

from __future__ import annotations
from typing import List, Optional


def pin_mode_allowed(roles: List[str], ipfs_mode: str, allow_stub_lab: bool = True) -> tuple[bool, str]:
    """Return (ok, reason)."""
    roles = [r.lower() for r in roles]
    if "pinner" not in roles:
        return True, "no pinner role"
    if ipfs_mode == "api":
        return True, "pinner + api mode"
    if ipfs_mode == "gateway":
        return True, "pinner + gateway (availability only; prefer api for durable pins)"
    if ipfs_mode == "stub" and allow_stub_lab:
        return True, "pinner + stub allowed (lab flag)"
    return False, "pinner role requires IPFS api mode (set IPFS_API_URL) or allow_stub_lab"


def enforce_or_warn(roles: List[str], ipfs_mode: str, strict: bool = False) -> dict:
    ok, reason = pin_mode_allowed(roles, ipfs_mode, allow_stub_lab=not strict)
    return {
        "ok": ok,
        "strict": strict,
        "ipfs_mode": ipfs_mode,
        "roles": roles,
        "reason": reason,
    }
