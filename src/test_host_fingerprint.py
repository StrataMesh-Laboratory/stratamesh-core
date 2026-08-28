"""Unit tests for computed host fingerprint (lab n=1).

Run: python3 test_host_fingerprint.py

Honesty:
  - same machine → same host_id
  - missing host_id fails
  - mesh_member true while comparing two equal host_ids is illegal
  - not multi-host; not a mesh claim
"""
from __future__ import annotations

import sys

from host_fingerprint import (
    HostFingerprintError,
    SOURCE_BOOT_ID,
    SOURCE_MACHINE_ID,
    SOURCE_UNAME,
    assert_equal_host_ids_not_mesh,
    assert_host_id_present,
    assert_status_host_honesty,
    fingerprint,
)


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        print(f"FAIL: {msg}")
        sys.exit(1)
    print(f"  OK: {msg}")


def test_same_machine_same_host_id() -> None:
    print("same machine → same host_id")
    a = fingerprint()
    b = fingerprint()
    assert_true(bool(a.get("host_id")), "first fingerprint has host_id")
    assert_true(a["host_id"] == b["host_id"], "two calls on this machine match")
    assert_true(a["source"] == b["source"], "source is stable across calls")
    assert_true(
        a["source"] in (SOURCE_MACHINE_ID, SOURCE_BOOT_ID, SOURCE_UNAME),
        f"source is documented ({a['source']})",
    )


def test_prefers_machine_id() -> None:
    print("prefers /etc/machine-id when present")
    files = {
        "/etc/machine-id": "AaBbCcDdEeFf00112233445566778899",
        "/proc/sys/kernel/random/boot_id": "11111111-2222-3333-4444-555555555555",
    }

    def read_file(path: str):
        return files.get(path)

    fp = fingerprint(read_file=read_file, uname_n="should-not-use")
    assert_true(fp["source"] == SOURCE_MACHINE_ID, "source is machine-id")
    assert_true(
        fp["host_id"] == "aabbccddeeff00112233445566778899",
        "host_id is normalized machine-id hex (not a hardcoded UUID)",
    )


def test_falls_back_boot_id_then_uname() -> None:
    print("fallback: boot_id then hashed uname -n")

    def none_reader(_path: str):
        return None

    fp_boot = fingerprint(
        read_file=lambda p: (
            "3c927b70-54bc-49e4-a270-53ff3cb757f4"
            if p.endswith("boot_id")
            else None
        ),
        uname_n="ignored-host",
    )
    assert_true(fp_boot["source"] == SOURCE_BOOT_ID, "empty machine-id → boot_id")
    assert_true(
        fp_boot["host_id"] == "3c927b7054bc49e4a27053ff3cb757f4",
        "boot_id dashes stripped",
    )

    fp_uname = fingerprint(read_file=none_reader, uname_n="lab-box")
    fp_uname2 = fingerprint(read_file=none_reader, uname_n="lab-box")
    fp_other = fingerprint(read_file=none_reader, uname_n="other-box")
    assert_true(fp_uname["source"] == SOURCE_UNAME, "empty ids → uname-n")
    assert_true(fp_uname["host_id"] == fp_uname2["host_id"], "same uname hashes equal")
    assert_true(fp_uname["host_id"] != fp_other["host_id"], "different uname hashes differ")
    assert_true(len(fp_uname["host_id"]) == 16, "uname fallback is short hex hash")


def test_missing_host_id_fails() -> None:
    print("missing host_id fails")
    raised = False
    try:
        assert_host_id_present({})
    except HostFingerprintError as exc:
        raised = True
        assert_true("missing host_id" in str(exc), "error names missing host_id")
    assert_true(raised, "empty payload raises")
    raised = False
    try:
        assert_host_id_present({"host_id": "   "})
    except HostFingerprintError:
        raised = True
    assert_true(raised, "whitespace host_id raises")
    raised = False
    try:
        assert_status_host_honesty([])
    except HostFingerprintError:
        raised = True
    assert_true(raised, "empty payload list raises")


def test_mesh_member_true_on_equal_host_ids_is_illegal() -> None:
    print("mesh_member true while comparing two equal host_ids is illegal")
    hid = fingerprint()["host_id"]
    fog = {
        "host_id": hid,
        "mesh_member": False,
        "node_id": "FOG-NODE-PT-CM-001",
    }
    edge = {
        "host_id": hid,
        "mesh_member": False,
        "node_id": "EDGE-GROK-CMN-001",
    }
    assert_equal_host_ids_not_mesh(fog, edge)
    assert_true(
        assert_status_host_honesty([fog, edge]) == hid,
        "honest equal host_ids with mesh_member false pass",
    )
    bad = dict(edge)
    bad["mesh_member"] = True
    raised = False
    try:
        assert_equal_host_ids_not_mesh(fog, bad)
    except HostFingerprintError as exc:
        raised = True
        assert_true("illegal" in str(exc), "error calls it illegal")
    assert_true(raised, "mesh_member true on equal host_ids raises")


if __name__ == "__main__":
    test_same_machine_same_host_id()
    test_prefers_machine_id()
    test_falls_back_boot_id_then_uname()
    test_missing_host_id_fails()
    test_mesh_member_true_on_equal_host_ids_is_illegal()
    print("\nAll host_fingerprint checks passed (lab n=1; not mesh).")
