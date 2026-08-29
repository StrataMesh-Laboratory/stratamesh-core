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
            "liboqs": self.try_liboqs_info(),
        }

    def lab_sign(self, key_id: str, message: str) -> dict:
        """Lab-only signature: HMAC-like hash over hint+message. NOT cryptographic PQ security."""
        rec = self.keys.get(key_id)
        if not rec:
            raise KeyError("unknown key_id")
        material = f"{rec.public_hint}|{rec.algorithm}|{message}".encode()
        sig = hashlib.sha256(material).hexdigest()
        return {
            "key_id": key_id,
            "algorithm": rec.algorithm,
            "message_sha256": hashlib.sha256(message.encode()).hexdigest(),
            "lab_sig": sig,
            "warning": "lab placeholder — not post-quantum secure",
        }

    def lab_verify(self, key_id: str, message: str, lab_sig: str) -> bool:
        try:
            return self.lab_sign(key_id, message)["lab_sig"] == lab_sig
        except Exception:
            return False

    def try_liboqs_info(self) -> dict:
        """Detect liboqs if installed; do not fail if absent.

        Never `import oqs` unless a shared lib is already present.
        liboqs-python auto-installs on import and raises SystemExit(1)
        when cmake is missing, which killed FOG-NODE-PT-CM-001 (origin 502).
        SystemExit is BaseException, so `except Exception` does not catch it.
        """
        try:
            from pathlib import Path
            import os
            root = Path(os.environ.get("OQS_INSTALL_PATH", str(Path.home() / "_oqs")))
            libs = list((root / "lib").glob("liboqs*")) + list((root / "lib64").glob("liboqs*"))
            if not libs:
                return {
                    "available": False,
                    "reason": "liboqs shared library absent; import skipped (oqs auto-install SystemExit)",
                }
            import oqs  # type: ignore
            return {
                "available": True,
                "kems": list(oqs.get_enabled_KEM_mechanisms())[:8],
                "sigs": list(oqs.get_enabled_sig_mechanisms())[:8],
            }
        except SystemExit as e:
            return {"available": False, "reason": f"liboqs install aborted: {e}"}
        except Exception as e:
            return {"available": False, "reason": str(e)}


def demo():
    r = PQKeyRegistry()
    k = r.generate("FOG-NODE-PT-CM-001", "Dilithium3-lab", purpose="tx-signing")
    print(k.key_id, k.algorithm)
    print(r.summary())
    print("pq_keys demo OK")


if __name__ == "__main__":
    demo()
