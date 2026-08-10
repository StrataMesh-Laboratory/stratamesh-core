"""
Post-quantum key hooks — Phase 7 scaffold
=========================================
Lab placeholders for lattice/code-based key material.
Does NOT implement real PQ crypto — records intent and metadata only.
Wire to liboqs / Cloudflare PQ worker when available.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time
import hashlib
import secrets


SUPPORTED_ALGORITHMS = (
    "Kyber768-lab",      # placeholder label
    "Dilithium3-lab",
    "SPHINCS+-lab",
)


@dataclass
class PQKeyRecord:
    key_id: str
    agent_id: str
    algorithm: str
    public_hint: str  # not a real public key
    created_at: float = field(default_factory=time.time)
    purpose: str = "node-identity"
    dag_tx: Optional[str] = None


class PQKeyRegistry:
    def __init__(self):
        self.keys: Dict[str, PQKeyRecord] = {}

    def _id(self, agent_id: str, algorithm: str) -> str:
        raw = f"{agent_id}|{algorithm}|{time.time()}"
        return "pq_" + hashlib.sha256(raw.encode()).hexdigest()[:14]

    def generate(self, agent_id: str, algorithm: str = "Kyber768-lab", purpose: str = "node-identity") -> PQKeyRecord:
        if algorithm not in SUPPORTED_ALGORITHMS:
            raise ValueError(f"unsupported algorithm; choose from {SUPPORTED_ALGORITHMS}")
        # Lab-only: random hint, not cryptographic material
        hint = secrets.token_hex(16)
        rec = PQKeyRecord(
            key_id=self._id(agent_id, algorithm),
            agent_id=agent_id,
            algorithm=algorithm,
            public_hint=hint,
            purpose=purpose,
        )
        self.keys[rec.key_id] = rec
        return rec

    def summary(self) -> dict:
        return {
            "total": len(self.keys),
            "algorithms": SUPPORTED_ALGORITHMS,
            "note": "lab placeholders — not production PQ keys",
            "keys": [
                {
                    "key_id": k.key_id,
                    "agent_id": k.agent_id,
                    "algorithm": k.algorithm,
                    "purpose": k.purpose,
                    "public_hint": k.public_hint[:12] + "…",
                    "dag_tx": k.dag_tx,
                }
                for k in list(self.keys.values())[-30:]
            ],
        }


def demo():
    r = PQKeyRegistry()
    k = r.generate("FOG-NODE-PT-CM-001", "Dilithium3-lab", purpose="tx-signing")
    print(k.key_id, k.algorithm)
    print(r.summary())
    print("pq_keys demo OK")


if __name__ == "__main__":
    demo()
