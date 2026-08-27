"""
Resource-proof MVP — one capacity class (`compute` / hash work-token)
====================================================================
Verifier-issued challenge → SHA-256 work → receipt.

Canonical class `compute` (work-unit) is defined in
docs/POC-RESOURCE-VS-FUNCTION.md §4: capacity to perform validation
or processing work. This module is the lab challenge/receipt for that
class only. Other classes (storage, bandwidth, availability) are out
of scope.

Honesty:
  - In-process evidence. Not a multi-host mint, not mainnet, not aBFT.
  - Does not credit STRATA and does not replace Worker `stratamesh-poc`.
  - ACB CPU/RSS meters (`resource_meter.py`) are consume estimates, not proofs.
  - Bare claim (no work token) and replay of a spent challenge are rejected.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Set
import hashlib
import time


RESOURCE_CLASS = "compute"
DEFAULT_DIFFICULTY = 2  # leading hex zeros; CI-cheap, still real hash work


@dataclass(frozen=True)
class ComputeChallenge:
    challenge_id: str
    agent_id: str
    seed: str
    difficulty: int
    resource_class: str = RESOURCE_CLASS
    issued_at: float = 0.0


@dataclass(frozen=True)
class ComputeProof:
    challenge_id: str
    agent_id: str
    nonce: Optional[int]
    digest: str
    resource_class: str = RESOURCE_CLASS


@dataclass(frozen=True)
class ComputeReceipt:
    receipt_id: str
    challenge_id: str
    agent_id: str
    work_units: float
    digest: str
    nonce: int
    resource_class: str = RESOURCE_CLASS


@dataclass
class VerifyResult:
    accepted: bool
    reason: str
    receipt: Optional[ComputeReceipt] = None


def work_preimage(challenge_id: str, agent_id: str, seed: str, nonce: int) -> bytes:
    return f"{challenge_id}|{agent_id}|{seed}|{nonce}".encode("utf-8")


def work_digest(challenge_id: str, agent_id: str, seed: str, nonce: int) -> str:
    return hashlib.sha256(work_preimage(challenge_id, agent_id, seed, nonce)).hexdigest()


def meets_difficulty(digest: str, difficulty: int) -> bool:
    if difficulty < 1:
        return False
    return digest.startswith("0" * difficulty)


def solve_compute_challenge(challenge: ComputeChallenge, max_nonce: int = 2_000_000) -> ComputeProof:
    """Perform the hash work. Test/demo helper — not a network miner."""
    for nonce in range(max_nonce):
        digest = work_digest(challenge.challenge_id, challenge.agent_id, challenge.seed, nonce)
        if meets_difficulty(digest, challenge.difficulty):
            return ComputeProof(
                challenge_id=challenge.challenge_id,
                agent_id=challenge.agent_id,
                nonce=nonce,
                digest=digest,
                resource_class=RESOURCE_CLASS,
            )
    raise RuntimeError("no nonce found within max_nonce (raise difficulty bound or max_nonce)")


class ComputeWorkVerifier:
    """In-process verifier: one receipt per challenge; replay and bare claims fail."""

    def __init__(self) -> None:
        self.challenges: Dict[str, ComputeChallenge] = {}
        self.redeemed: Set[str] = set()
        self.seen_digests: Set[str] = set()
        self.receipts: Dict[str, ComputeReceipt] = {}
        self._n = 0

    def _id(self, prefix: str, *parts: str) -> str:
        self._n += 1
        raw = "|".join(parts) + f"|{self._n}|{time.time()}"
        return prefix + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]

    def issue_challenge(self, agent_id: str, difficulty: int = DEFAULT_DIFFICULTY) -> ComputeChallenge:
        if not agent_id or difficulty < 1:
            raise ValueError("agent_id required and difficulty >= 1")
        cid = self._id("ch_", agent_id, str(difficulty))
        seed = hashlib.sha256(f"{cid}|{agent_id}|{self._n}".encode("utf-8")).hexdigest()[:16]
        ch = ComputeChallenge(
            challenge_id=cid,
            agent_id=agent_id,
            seed=seed,
            difficulty=difficulty,
            resource_class=RESOURCE_CLASS,
            issued_at=time.time(),
        )
        self.challenges[cid] = ch
        return ch

    def verify_bare_claim(self, agent_id: str, units: float) -> VerifyResult:
        """Explicit pure claim: quantity with no work token. Always rejected."""
        return VerifyResult(accepted=False, reason="bare_claim")

    def verify(self, proof: Optional[ComputeProof]) -> VerifyResult:
        if proof is None:
            return VerifyResult(accepted=False, reason="bare_claim")
        if proof.nonce is None or proof.digest is None or str(proof.digest).strip() == "":
            return VerifyResult(accepted=False, reason="empty_proof")
        if proof.resource_class != RESOURCE_CLASS:
            return VerifyResult(accepted=False, reason="wrong_class")
        ch = self.challenges.get(proof.challenge_id)
        if ch is None:
            return VerifyResult(accepted=False, reason="unknown_challenge")
        if proof.challenge_id in self.redeemed or proof.digest in self.seen_digests:
            return VerifyResult(accepted=False, reason="replay")
        if proof.agent_id != ch.agent_id:
            return VerifyResult(accepted=False, reason="agent_mismatch")
        expected = work_digest(ch.challenge_id, ch.agent_id, ch.seed, int(proof.nonce))
        if expected != proof.digest:
            return VerifyResult(accepted=False, reason="bad_digest")
        if not meets_difficulty(expected, ch.difficulty):
            return VerifyResult(accepted=False, reason="difficulty")
        receipt = ComputeReceipt(
            receipt_id=self._id("rcpt_", proof.challenge_id, proof.digest),
            challenge_id=proof.challenge_id,
            agent_id=proof.agent_id,
            work_units=float(16 ** ch.difficulty),
            digest=expected,
            nonce=int(proof.nonce),
            resource_class=RESOURCE_CLASS,
        )
        self.redeemed.add(proof.challenge_id)
        self.seen_digests.add(expected)
        self.receipts[receipt.receipt_id] = receipt
        return VerifyResult(accepted=True, reason="ok", receipt=receipt)


def demo() -> None:
    v = ComputeWorkVerifier()
    ch = v.issue_challenge("lab-agent", difficulty=2)
    proof = solve_compute_challenge(ch)
    r = v.verify(proof)
    print({"challenge": ch.challenge_id, "nonce": proof.nonce, "digest": proof.digest, "result": r.reason})
    print("resource_proof demo OK" if r.accepted else "resource_proof demo FAIL")


if __name__ == "__main__":
    demo()
