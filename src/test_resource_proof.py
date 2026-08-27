"""
Resource-proof MVP — compute / hash work-token (in-process).

Run: python3 test_resource_proof.py

Honesty:
  - Accepts a valid SHA-256 work token for class `compute` only.
  - Rejects a bare claim (quantity, no proof) and replay of a spent challenge.
  - In-process evidence; not a multi-host mint, not STRATA credit, not aBFT.
"""
from __future__ import annotations

import sys

from resource_proof import (
    RESOURCE_CLASS,
    ComputeProof,
    ComputeWorkVerifier,
    solve_compute_challenge,
)


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        print(f"FAIL: {msg}")
        sys.exit(1)
    print(f"  OK: {msg}")


def test_accept_valid_proof() -> None:
    print("accept valid compute hash-work proof")
    v = ComputeWorkVerifier()
    ch = v.issue_challenge("agent-a", difficulty=2)
    proof = solve_compute_challenge(ch)
    r = v.verify(proof)
    assert_true(r.accepted, "valid proof accepted")
    assert_true(r.reason == "ok", "reason is ok")
    assert_true(r.receipt is not None, "receipt issued")
    assert_true(r.receipt.resource_class == RESOURCE_CLASS, "receipt class is compute")
    assert_true(r.receipt.agent_id == "agent-a", "receipt bound to agent")
    assert_true(r.receipt.digest == proof.digest, "receipt digest matches proof")
    assert_true(r.receipt.work_units > 0, "work_units are measurable")


def test_reject_bare_claim() -> None:
    print("reject bare claim (no work token)")
    v = ComputeWorkVerifier()
    r = v.verify_bare_claim("agent-a", units=10.0)
    assert_true(not r.accepted, "bare claim rejected")
    assert_true(r.reason == "bare_claim", "reason is bare_claim")
    assert_true(r.receipt is None, "no receipt on bare claim")
    r2 = v.verify(None)
    assert_true(not r2.accepted and r2.reason == "bare_claim", "None proof is a bare claim")


def test_reject_empty_proof() -> None:
    print("reject empty proof")
    v = ComputeWorkVerifier()
    ch = v.issue_challenge("agent-a", difficulty=2)
    empty = ComputeProof(
        challenge_id=ch.challenge_id,
        agent_id="agent-a",
        nonce=None,
        digest="",
        resource_class=RESOURCE_CLASS,
    )
    r = v.verify(empty)
    assert_true(not r.accepted, "empty proof rejected")
    assert_true(r.reason == "empty_proof", "reason is empty_proof")


def test_reject_replay() -> None:
    print("reject replay of a spent challenge")
    v = ComputeWorkVerifier()
    ch = v.issue_challenge("agent-a", difficulty=2)
    proof = solve_compute_challenge(ch)
    r1 = v.verify(proof)
    r2 = v.verify(proof)
    assert_true(r1.accepted, "first submit accepted")
    assert_true(not r2.accepted, "second submit rejected")
    assert_true(r2.reason == "replay", "reason is replay")
    assert_true(r2.receipt is None, "no second receipt")
    assert_true(len(v.receipts) == 1, "exactly one receipt")


def test_reject_bad_digest() -> None:
    print("reject forged digest")
    v = ComputeWorkVerifier()
    ch = v.issue_challenge("agent-a", difficulty=2)
    proof = solve_compute_challenge(ch)
    forged = ComputeProof(
        challenge_id=proof.challenge_id,
        agent_id=proof.agent_id,
        nonce=proof.nonce,
        digest="0" * 64,
        resource_class=RESOURCE_CLASS,
    )
    r = v.verify(forged)
    assert_true(not r.accepted, "forged digest rejected")
    assert_true(r.reason == "bad_digest", "reason is bad_digest")


if __name__ == "__main__":
    test_accept_valid_proof()
    test_reject_bare_claim()
    test_reject_empty_proof()
    test_reject_replay()
    test_reject_bad_digest()
    print("\nAll resource-proof MVP checks passed (in-process compute hash-work; not a multi-host mint).")
