"""Computed host fingerprint for Fog/EDGE /status.

Prefers /etc/machine-id (stable across boots on this box), else
/proc/sys/kernel/random/boot_id (stable until reboot), else a short
sha256 of uname -n. Paths and readers are injectable so the helper is
unit-testable.

This identifies the *machine*, not a mesh. Two processes that share
host_id are on the same host — they must not set mesh_member true.
Not multi-host. Not aBFT. Lab n=1 only.
"""
from __future__ import annotations

import hashlib
import platform
from typing import Callable, Dict, Iterable, Optional

MACHINE_ID_PATH = "/etc/machine-id"
BOOT_ID_PATH = "/proc/sys/kernel/random/boot_id"

SOURCE_MACHINE_ID = "machine-id"  # /etc/machine-id
SOURCE_BOOT_ID = "boot_id"        # /proc/sys/kernel/random/boot_id
SOURCE_UNAME = "uname-n"          # sha256(uname -n)[:16]


class HostFingerprintError(ValueError):
    """Honesty / presence failure for host_id on status payloads."""


def _read_stripped(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read().strip()
        return text or None
    except OSError:
        return None


def _normalize_id(raw: str) -> str:
    """Hex-ish id: strip, drop UUID dashes, lowercase. Empty after that is missing."""
    cleaned = (raw or "").strip().replace("-", "").lower()
    return cleaned


def _hash_uname(name: str) -> str:
    return hashlib.sha256(name.encode("utf-8", errors="replace")).hexdigest()[:16]


def fingerprint(
    *,
    machine_id_path: str = MACHINE_ID_PATH,
    boot_id_path: str = BOOT_ID_PATH,
    uname_n: Optional[str] = None,
    read_file: Optional[Callable[[str], Optional[str]]] = None,
) -> Dict[str, str]:
    """Return {host_id, source} computed from this machine (or injected inputs).

    source is one of: "machine-id", "boot_id", "uname-n".
    """
    reader = read_file or _read_stripped

    mid = _normalize_id(reader(machine_id_path) or "")
    if mid:
        return {"host_id": mid, "source": SOURCE_MACHINE_ID}

    bid = _normalize_id(reader(boot_id_path) or "")
    if bid:
        return {"host_id": bid, "source": SOURCE_BOOT_ID}

    name = uname_n if uname_n is not None else (platform.node() or "")
    if not name:
        name = "unknown-host"
    return {"host_id": _hash_uname(name), "source": SOURCE_UNAME}


def assert_host_id_present(payload: dict) -> str:
    """Fail if status payload is missing a non-empty host_id."""
    hid = payload.get("host_id") if isinstance(payload, dict) else None
    if not isinstance(hid, str) or not hid.strip():
        raise HostFingerprintError("missing host_id")
    return hid.strip()


def assert_equal_host_ids_not_mesh(a: dict, b: dict) -> None:
    """Equal host_ids mean same machine — mesh_member true is illegal.

    Used as the n=1 honesty check: Fog and EDGE on this box share host_id
    and must both keep mesh_member false.
    """
    ha = assert_host_id_present(a)
    hb = assert_host_id_present(b)
    if ha == hb and (a.get("mesh_member") is True or b.get("mesh_member") is True):
        raise HostFingerprintError(
            "mesh_member true while host_ids are equal is illegal "
            "(same machine is not a mesh)"
        )


def assert_status_host_honesty(payloads: Iterable[dict]) -> str:
    """All payloads must have host_id; shared host_id forbids mesh_member true.

    Returns the shared host_id when every payload agrees; if host_ids differ
    this is not n=1 same-host and we still reject mesh_member true on any
    equal pair.
    """
    items = list(payloads)
    if not items:
        raise HostFingerprintError("missing host_id")
    ids = [assert_host_id_present(p) for p in items]
    for i, pa in enumerate(items):
        for pb in items[i + 1 :]:
            assert_equal_host_ids_not_mesh(pa, pb)
    if len(set(ids)) == 1:
        return ids[0]
    return ids[0]
