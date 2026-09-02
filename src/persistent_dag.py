"""
StrataMesh Persistent DAG — Phase 1 Scaffold
============================================
SQLite-backed DAG store. Drop-in evolution of the in-memory DAG.
Keeps the same public interface while surviving process restarts.

Future: replace SQLite with a more efficient append-only / LSM store
and add Merkle proofs / cumulative-weight indexes.
"""

from __future__ import annotations
import json
import sqlite3
import time
from pathlib import Path
from typing import List, Optional, Dict, Set
from tip_selection import Transaction, TxType, DAG


class PersistentDAG(DAG):
    def __init__(self, db_path: str = "stratamesh.db"):
        super().__init__()
        self.db_path = db_path
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()
        self._load()

    def _init_schema(self):
        cur = self._conn.cursor()
        cur.executescript("""
        CREATE TABLE IF NOT EXISTS transactions (
            tx_id TEXT PRIMARY KEY,
            tx_type TEXT NOT NULL,
            parents TEXT NOT NULL,          -- JSON array
            weight REAL NOT NULL,
            cumulative_weight REAL NOT NULL,
            timestamp REAL NOT NULL,
            cid TEXT,
            sender TEXT
        );
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        """)
        self._conn.commit()

    def _load(self):
        cur = self._conn.cursor()
        rows = cur.execute("SELECT * FROM transactions").fetchall()
        self.txs.clear()
        self.tips.clear()
        for r in rows:
            try:
                tx_type = TxType(r["tx_type"])
            except ValueError:
                tx_type = TxType.STANDARD
            tx = Transaction(
                tx_id=r["tx_id"],
                tx_type=tx_type,
                parents=json.loads(r["parents"]),
                weight=r["weight"],
                cumulative_weight=r["cumulative_weight"],
                timestamp=r["timestamp"],
                cid=r["cid"],
                sender=r["sender"],
            )
            self.txs[tx.tx_id] = tx
        # Rebuild tips: any tx that is not referenced as a parent
        referenced = set()
        for tx in self.txs.values():
            referenced.update(tx.parents)
        self.tips = set(self.txs.keys()) - referenced
        if not self.txs:
            self.bootstrap()
            self._persist_tx(self.txs["genesis"])
        else:
            row = cur.execute("SELECT value FROM meta WHERE key='genesis_id'").fetchone()
            self.genesis_id = row["value"] if row else "genesis"

    def _persist_tx(self, tx: Transaction):
        cur = self._conn.cursor()
        cur.execute(
            """INSERT OR REPLACE INTO transactions
               (tx_id, tx_type, parents, weight, cumulative_weight, timestamp, cid, sender)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                tx.tx_id,
                tx.tx_type.value,
                json.dumps(tx.parents),
                tx.weight,
                tx.cumulative_weight,
                tx.timestamp,
                tx.cid,
                tx.sender,
            ),
        )
        self._conn.commit()

    def bootstrap(self) -> str:
        gid = super().bootstrap()
        cur = self._conn.cursor()
        cur.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('genesis_id', ?)", (gid,))
        self._conn.commit()
        self._persist_tx(self.txs[gid])
        return gid

    def attach(self, tx: Transaction) -> bool:
        ok = super().attach(tx)
        if ok:
            self._persist_tx(tx)
            # Also update parents' cumulative weights in DB (naive)
            for p in tx.parents:
                if p in self.txs:
                    self._persist_tx(self.txs[p])
        return ok

    def close(self):
        self._conn.close()
