"""
On-graph SPA registration — Phase 2 scaffold
============================================
Service Provision Agreements as first-class DAG transactions.
Substrate-neutral parties (Fog/Edge/ACB/operator).
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from enum import Enum
import json
import time
import hashlib

from tip_selection import Transaction, TxType, DAG


class SPARole(Enum):
    FOG = "fog"
    EDGE = "edge"
    PINNER = "pinner"
    VALIDATOR = "validator"
    HYBRID = "hybrid"


@dataclass
class SPARecord:
    spa_id: str
    provider_id: str
    roles: List[str]
    service_level: Dict[str, Any]
    opt_out_days: int = 14
    active: bool = True
    created_at: float = field(default_factory=time.time)
    tx_id: Optional[str] = None
    cid: Optional[str] = None  # optional full SPA document on IPFS

    def to_payload(self) -> dict:
        return {
            "spa_id": self.spa_id,
            "provider_id": self.provider_id,
            "roles": self.roles,
            "service_level": self.service_level,
            "opt_out_days": self.opt_out_days,
            "active": self.active,
            "created_at": self.created_at,
            "cid": self.cid,
        }

    @staticmethod
    def make_id(provider_id: str, roles: List[str]) -> str:
        raw = f"{provider_id}|{','.join(sorted(roles))}|{time.time()}"
        return "spa_" + hashlib.sha256(raw.encode()).hexdigest()[:16]


class SPARegistry:
    """In-memory + DAG-backed SPA registry."""

    def __init__(self, dag: DAG):
        self.dag = dag
        self.spas: Dict[str, SPARecord] = {}

    def register(
        self,
        provider_id: str,
        roles: List[str],
        service_level: Optional[Dict[str, Any]] = None,
        cid: Optional[str] = None,
        opt_out_days: int = 14,
    ) -> SPARecord:
        spa_id = SPARecord.make_id(provider_id, roles)
        rec = SPARecord(
            spa_id=spa_id,
            provider_id=provider_id,
            roles=roles,
            service_level=service_level or {
                "uptime_pct": 99.0,
                "max_sync_lag_sec": 120,
            },
            opt_out_days=opt_out_days,
            cid=cid,
        )
        parents = self.dag.select_tips(k=2) or (["genesis"] if "genesis" in self.dag.txs else [])
        if not self.dag.txs:
            self.dag.bootstrap()
            parents = ["genesis"]

        payload = json.dumps(rec.to_payload(), sort_keys=True)
        tx = Transaction(
            tx_id=Transaction.make_id(spa_id, str(time.time())),
            tx_type=TxType.SPA,
            parents=parents,
            weight=1.0,
            cid=cid,
            sender=provider_id,
        )
        # stash payload hash in sender field extension via cid if needed
        ok = self.dag.attach(tx)
        if not ok:
            raise RuntimeError("SPA registration tx rejected by DAG")
        rec.tx_id = tx.tx_id
        self.spas[spa_id] = rec
        return rec

    def deactivate(self, spa_id: str) -> bool:
        rec = self.spas.get(spa_id)
        if not rec:
            return False
        rec.active = False
        return True

    def active_for(self, provider_id: str) -> List[SPARecord]:
        return [s for s in self.spas.values() if s.provider_id == provider_id and s.active]

    def all_active(self) -> List[SPARecord]:
        return [s for s in self.spas.values() if s.active]


    def export_records(self) -> list:
        return [
            {
                "spa_id": r.spa_id,
                "provider_id": r.provider_id,
                "roles": list(r.roles),
                "service_level": r.service_level,
                "opt_out_days": r.opt_out_days,
                "cid": r.cid,
                "tx_id": r.tx_id,
                "active": r.active,
            }
            for r in self.spas.values()
        ]

    def import_record(self, data: dict) -> bool:
        """Accept SPA metadata from a peer (does not re-mine DAG tx)."""
        spa_id = data.get("spa_id")
        if not spa_id:
            return False
        if spa_id in self.spas:
            # refresh active flag
            self.spas[spa_id].active = bool(data.get("active", True))
            return True
        rec = SPARecord(
            spa_id=spa_id,
            provider_id=str(data.get("provider_id") or "unknown"),
            roles=list(data.get("roles") or []),
            service_level=data.get("service_level") or {},
            opt_out_days=int(data.get("opt_out_days") or 14),
            cid=data.get("cid"),
            active=bool(data.get("active", True)),
        )
        rec.tx_id = data.get("tx_id")
        self.spas[spa_id] = rec
        return True


    def request_opt_out(self, spa_id: str, reason: str = "") -> dict:
        """Begin opt-out; active until grace period elapses (lab: immediate deactivate flag + timestamp)."""
        rec = self.spas.get(spa_id)
        if not rec:
            raise KeyError("spa not found")
        rec.active = False
        meta = {
            "spa_id": spa_id,
            "provider_id": rec.provider_id,
            "opt_out_days": rec.opt_out_days,
            "reason": reason,
            "status": "opted_out",
            "at": time.time(),
        }
        return meta

    def list_by_provider(self, provider_id: str) -> list:
        return [r for r in self.spas.values() if r.provider_id == provider_id]

    def summary(self) -> dict:
        return {
            "total": len(self.spas),
            "active": len(self.all_active()),
            "by_role": _count_roles(self.all_active()),
        }


def _count_roles(spas: List[SPARecord]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for s in spas:
        for r in s.roles:
            out[r] = out.get(r, 0) + 1
    return out


def demo():
    from tip_selection import DAG
    dag = DAG()
    dag.bootstrap()
    reg = SPARegistry(dag)
    r1 = reg.register("FOG-NODE-PT-CM-001", ["fog", "pinner"], cid="bafy-spa-template")
    r2 = reg.register("EDGE-SIM-01", ["edge"])
    print("SPA registry demo")
    print(" registered:", r1.spa_id, r1.tx_id)
    print(" registered:", r2.spa_id, r2.tx_id)
    print(" summary:", reg.summary())
    print(" dag txs:", dag.stats())
    print("OK")


if __name__ == "__main__":
    demo()
