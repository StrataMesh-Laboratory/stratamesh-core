"""
StrataMesh Gossip — Phase 1
===========================
Simple message types for tip/transaction exchange and missing-parent resolution.

Messages:
  - INV      : announce known tx_ids (inventory)
  - GETDATA  : request full transactions by id
  - TX       : full transaction payload
  - GETPARENTS: request parents of a given tx (for gap filling)
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from tip_selection import Transaction, TxType
import json
import time


class MsgType:
    INV = "inv"
    GETDATA = "getdata"
    TX = "tx"
    GETPARENTS = "getparents"
    PARENTS = "parents"


def encode(msg_type: str, payload: dict) -> bytes:
    return json.dumps({"type": msg_type, "payload": payload, "ts": time.time()}).encode()


def decode(data: bytes) -> dict:
    return json.loads(data.decode())


def make_inv(tx_ids: List[str]) -> bytes:
    return encode(MsgType.INV, {"ids": tx_ids})


def make_getdata(tx_ids: List[str]) -> bytes:
    return encode(MsgType.GETDATA, {"ids": tx_ids})


def make_tx(tx: Transaction) -> bytes:
    return encode(MsgType.TX, {
        "tx_id": tx.tx_id,
        "tx_type": tx.tx_type.value,
        "parents": tx.parents,
        "weight": tx.weight,
        "cumulative_weight": tx.cumulative_weight,
        "timestamp": tx.timestamp,
        "cid": tx.cid,
        "sender": tx.sender,
    })


def make_getparents(tx_id: str) -> bytes:
    return encode(MsgType.GETPARENTS, {"tx_id": tx_id})


def make_parents(tx_id: str, parent_txs: List[Transaction]) -> bytes:
    return encode(MsgType.PARENTS, {
        "tx_id": tx_id,
        "parents": [
            {
                "tx_id": p.tx_id,
                "tx_type": p.tx_type.value,
                "parents": p.parents,
                "weight": p.weight,
                "cumulative_weight": p.cumulative_weight,
                "timestamp": p.timestamp,
                "cid": p.cid,
                "sender": p.sender,
            }
            for p in parent_txs
        ],
    })


def tx_from_payload(p: dict) -> Transaction:
    return Transaction(
        tx_id=p["tx_id"],
        tx_type=TxType(p["tx_type"]),
        parents=p["parents"],
        weight=p.get("weight", 1.0),
        cumulative_weight=p.get("cumulative_weight", 1.0),
        timestamp=p.get("timestamp", time.time()),
        cid=p.get("cid"),
        sender=p.get("sender"),
    )


class GossipNode:
    """
    Mixin-style helper that a FogNode can use to handle gossip messages
    and request missing parents before attaching a transaction.
    """

    def __init__(self, dag):
        self.dag = dag
        self.pending: Dict[str, Transaction] = {}  # tx_id -> tx waiting for parents

    def handle_message(self, raw: bytes) -> List[bytes]:
        """Process one gossip message; return list of reply messages (may be empty)."""
        try:
            msg = decode(raw)
        except Exception:
            return []
        t = msg.get("type")
        p = msg.get("payload", {})
        replies: List[bytes] = []

        if t == MsgType.INV:
            unknown = [i for i in p.get("ids", []) if i not in self.dag.txs]
            if unknown:
                replies.append(make_getdata(unknown[:32]))

        elif t == MsgType.GETDATA:
            for i in p.get("ids", []):
                if i in self.dag.txs:
                    replies.append(make_tx(self.dag.txs[i]))

        elif t == MsgType.TX:
            tx = tx_from_payload(p)
            replies.extend(self._try_attach(tx))

        elif t == MsgType.GETPARENTS:
            tx_id = p.get("tx_id")
            if tx_id in self.dag.txs:
                parents = [self.dag.txs[pid] for pid in self.dag.txs[tx_id].parents if pid in self.dag.txs]
                replies.append(make_parents(tx_id, parents))

        elif t == MsgType.PARENTS:
            for pp in p.get("parents", []):
                parent_tx = tx_from_payload(pp)
                self._try_attach(parent_tx)
            # retry any pending that might now be satisfiable
            for pending_id in list(self.pending.keys()):
                replies.extend(self._try_attach(self.pending[pending_id]))

        return replies

    def _try_attach(self, tx: Transaction) -> List[bytes]:
        if tx.tx_id in self.dag.txs:
            self.pending.pop(tx.tx_id, None)
            return []
        missing = [pid for pid in tx.parents if pid not in self.dag.txs]
        if missing:
            self.pending[tx.tx_id] = tx
            # request the missing parents
            return [make_getdata(missing)]
        ok = self.dag.attach(tx)
        if ok:
            self.pending.pop(tx.tx_id, None)
        return []
