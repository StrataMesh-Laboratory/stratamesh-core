"""
StrataMesh digital objects — protocol-native registry
=====================================================
Four layers: CID (content identity), DAG (history), object_id (network
identity), STRATA (economic — reserved until oracle_live).

GNU Atelier is an optional renderer, not the object type.
object_id mint is lab_waived; STRATA value mint is not.
No workers.dev. Fog sqlite is the lab ledger.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

DEFAULT_SQLITE = os.environ.get("FOG_SQLITE_PATH") or "/tmp/stratamesh-fog.db"
DEFAULT_OWNER = "FOG-NODE-PT-CM-001"
ORACLE_LIVE = False
ALPHA32 = "abcdefghijklmnopqrstuvwxyz234567"


class StrataReservedError(ValueError):
    """STRATA economic mint is reserved until oracle_live."""


def content_cid(value: Any) -> str:
    """Local content CID (sha256 → base32, bafy prefix). Not a Kubo CID v1."""
    if isinstance(value, str):
        s = value
    else:
        s = json.dumps(value, separators=(",", ":"), sort_keys=True)
    digest = hashlib.sha256(s.encode("utf-8")).hexdigest()
    bits = "".join(f"{int(digest[i : i + 2], 16):08b}" for i in range(0, len(digest), 2))
    out = []
    for i in range(0, len(bits) - (len(bits) % 5), 5):
        out.append(ALPHA32[int(bits[i : i + 5], 2)])
    return "bafy" + "".join(out)[:52]


def object_id_for(manifest_cid: str, owner: str) -> str:
    raw = f"{manifest_cid}|{owner}"
    return "obj_" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


@dataclass
class DigitalObject:
    object_id: str
    manifest_cid: str
    owner: str
    title: str = ""
    kind: str = "ugc"
    renderer: Optional[str] = None
    parts: Dict = field(default_factory=dict)
    meta: Dict = field(default_factory=dict)
    dag_tx: Optional[str] = None
    strata_units: float = 0.0
    created_at: float = 0.0
    updated_at: float = 0.0

    @property
    def asset_id(self) -> str:
        return self.object_id

    @property
    def cid(self) -> str:
        return self.manifest_cid

    def to_dict(self) -> dict:
        return {
            "object_id": self.object_id,
            "asset_id": self.object_id,
            "manifest_cid": self.manifest_cid,
            "cid": self.manifest_cid,
            "owner": self.owner,
            "title": self.title,
            "kind": self.kind,
            "renderer": self.renderer,
            "parts": self.parts,
            "meta": self.meta,
            "dag_tx": self.dag_tx,
            "strata_units": self.strata_units,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


# Back-compat name used by older call sites
NFTAsset = DigitalObject


OBJECTS_SCHEMA = """
CREATE TABLE IF NOT EXISTS objects (
    object_id TEXT PRIMARY KEY,
    manifest_cid TEXT NOT NULL,
    owner TEXT NOT NULL,
    title TEXT,
    kind TEXT,
    renderer TEXT,
    parts_json TEXT,
    meta_json TEXT,
    dag_tx TEXT,
    strata_units REAL DEFAULT 0,
    created_at REAL,
    updated_at REAL
);
CREATE INDEX IF NOT EXISTS idx_objects_cid ON objects(manifest_cid);
CREATE INDEX IF NOT EXISTS idx_objects_owner ON objects(owner);
"""


class ObjectRegistry:
    def __init__(
        self,
        db_path: Optional[str] = None,
        ipfs=None,
        dag=None,
    ):
        self.db_path = db_path or DEFAULT_SQLITE
        self._ipfs = ipfs
        self._dag = dag
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(OBJECTS_SCHEMA)
        self._conn.commit()
        self.assets: Dict[str, DigitalObject] = {}
        self._load()

    def _load(self) -> None:
        self.assets.clear()
        rows = self._conn.execute("SELECT * FROM objects").fetchall()
        for r in rows:
            obj = self._row_to_obj(r)
            self.assets[obj.object_id] = obj

    def _row_to_obj(self, r: sqlite3.Row) -> DigitalObject:
        parts = {}
        meta = {}
        try:
            parts = json.loads(r["parts_json"] or "{}")
        except Exception:
            parts = {}
        try:
            meta = json.loads(r["meta_json"] or "{}")
        except Exception:
            meta = {}
        return DigitalObject(
            object_id=r["object_id"],
            manifest_cid=r["manifest_cid"],
            owner=r["owner"],
            title=r["title"] or "",
            kind=r["kind"] or "ugc",
            renderer=r["renderer"],
            parts=parts if isinstance(parts, dict) else {},
            meta=meta if isinstance(meta, dict) else {},
            dag_tx=r["dag_tx"],
            strata_units=float(r["strata_units"] or 0),
            created_at=float(r["created_at"] or 0),
            updated_at=float(r["updated_at"] or 0),
        )

    def _persist(self, obj: DigitalObject) -> None:
        self._conn.execute(
            """INSERT OR REPLACE INTO objects
               (object_id, manifest_cid, owner, title, kind, renderer,
                parts_json, meta_json, dag_tx, strata_units, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                obj.object_id,
                obj.manifest_cid,
                obj.owner,
                obj.title,
                obj.kind,
                obj.renderer,
                json.dumps(obj.parts, separators=(",", ":")),
                json.dumps(obj.meta, separators=(",", ":")),
                obj.dag_tx,
                obj.strata_units,
                obj.created_at,
                obj.updated_at,
            ),
        )
        self._conn.commit()
        self.assets[obj.object_id] = obj

    def _ipfs_client(self):
        if self._ipfs is not None:
            return self._ipfs
        try:
            from ipfs_client import IPFSClient

            self._ipfs = IPFSClient(mode="stub", db_path=self.db_path)
        except Exception:
            self._ipfs = None
        return self._ipfs

    def _attach_dag_tx(self, sender: str, cid: str, tx_kind: str = "object_compose") -> Optional[str]:
        """Attach a DAG vertex. Prefer PersistentDAG; else sqlite transactions."""
        if self._dag is not None:
            try:
                parents = self._dag.select_tips(k=2)
                from tip_selection import Transaction, TxType

                t = TxType.STANDARD
                for name in (tx_kind.upper(),):
                    if hasattr(TxType, name):
                        t = getattr(TxType, name)
                tx = Transaction(
                    tx_id=Transaction.make_id(cid, sender, str(time.time()), tx_kind),
                    tx_type=t,
                    parents=parents or (["genesis"] if "genesis" in getattr(self._dag, "txs", {}) else []),
                    weight=1.0,
                    cid=cid,
                    sender=sender,
                )
                ok = self._dag.attach(tx)
                return tx.tx_id if ok else None
            except Exception:
                pass
        try:
            from persistent_dag import PersistentDAG
            from tip_selection import Transaction, TxType

            dag = PersistentDAG(self.db_path)
            try:
                parents = dag.select_tips(k=2)
                t = TxType.STANDARD
                if hasattr(TxType, "OBJECT_COMPOSE") and tx_kind == "object_compose":
                    t = TxType.OBJECT_COMPOSE
                elif hasattr(TxType, "OBJECT_TRANSFER") and tx_kind == "object_transfer":
                    t = TxType.OBJECT_TRANSFER
                tx = Transaction(
                    tx_id=Transaction.make_id(cid, sender, str(time.time()), tx_kind),
                    tx_type=t,
                    parents=parents or ([dag.genesis_id] if dag.genesis_id else []),
                    weight=1.0,
                    cid=cid,
                    sender=sender,
                )
                ok = dag.attach(tx)
                return tx.tx_id if ok else None
            finally:
                dag.close()
        except Exception:
            pass
        # Fallback: write STANDARD row with cid=manifest_cid (same sqlite as Fog).
        try:
            self._conn.execute(
                """CREATE TABLE IF NOT EXISTS transactions (
                    tx_id TEXT PRIMARY KEY,
                    tx_type TEXT NOT NULL,
                    parents TEXT NOT NULL,
                    weight REAL NOT NULL,
                    cumulative_weight REAL NOT NULL,
                    timestamp REAL NOT NULL,
                    cid TEXT,
                    sender TEXT
                )"""
            )
            tx_id = hashlib.sha256(
                f"{tx_kind}|{cid}|{sender}|{time.time()}".encode()
            ).hexdigest()[:16]
            now = time.time()
            self._conn.execute(
                """INSERT OR REPLACE INTO transactions
                   (tx_id, tx_type, parents, weight, cumulative_weight, timestamp, cid, sender)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (tx_id, tx_kind, json.dumps(["genesis"]), 1.0, 1.0, now, cid, sender),
            )
            self._conn.commit()
            return tx_id
        except Exception:
            return None

    def _pin(self, cid: str) -> None:
        client = self._ipfs_client()
        if client is None:
            return
        try:
            client.request_pin(cid)
        except Exception:
            pass

    def compose(
        self,
        owner: str,
        manifest_cid: Optional[str] = None,
        parts: Optional[Dict] = None,
        kind: str = "ugc",
        title: str = "",
        renderer: Optional[str] = None,
        meta: Optional[Dict] = None,
        strata_units: float = 0,
        lab_waived: bool = True,
        **extra,
    ) -> DigitalObject:
        """Register (or fetch) a network object_id. STRATA value stays 0."""
        if strata_units and float(strata_units) != 0:
            raise StrataReservedError(
                "oracle_live false: STRATA economic reserved; lab_waived allows object_id only"
            )
        if extra.get("collateral_strata") not in (None, 0, 0.0, "0"):
            raise StrataReservedError(
                "oracle_live false: STRATA economic reserved; lab_waived allows object_id only"
            )
        if not lab_waived and not ORACLE_LIVE:
            raise StrataReservedError("object_id mint requires lab_waived until oracle_live")
        owner = (owner or DEFAULT_OWNER).strip() or DEFAULT_OWNER
        parts = parts if isinstance(parts, dict) else {}
        meta = dict(meta or {})
        if extra:
            for k, v in extra.items():
                if k not in ("collateral_strata", "strata_units"):
                    meta.setdefault(k, v)
        cid = (manifest_cid or "").strip()
        if not cid and not parts:
            raise ValueError("compose requires parts or cid")
        if not cid:
            cid = content_cid({"parts": parts, "kind": kind, "title": title, "owner": owner})
        oid = object_id_for(cid, owner)
        existing = self.get(oid)
        if existing:
            return existing
        now = time.time()
        rend = renderer
        if rend in ("", "null"):
            rend = None
        obj = DigitalObject(
            object_id=oid,
            manifest_cid=cid,
            owner=owner,
            title=title or cid[:16],
            kind=kind or "ugc",
            renderer=rend,
            parts=parts,
            meta=meta,
            dag_tx=None,
            strata_units=0.0,
            created_at=now,
            updated_at=now,
        )
        obj.dag_tx = self._attach_dag_tx(owner, cid, "object_compose")
        self._persist(obj)
        self._pin(cid)
        return obj

    register = compose

    def mint(self, owner: str, cid: str, title: str = "", **meta) -> DigitalObject:
        """Back-compat: CID registry mint == object compose (no STRATA)."""
        kind = str(meta.pop("kind", "ugc") or "ugc")
        renderer = meta.pop("renderer", None)
        parts = meta.pop("parts", {}) or {}
        return self.compose(
            owner=owner,
            manifest_cid=cid,
            parts=parts if isinstance(parts, dict) else {},
            kind=kind,
            title=title,
            renderer=renderer,
            meta=meta,
        )

    def get(self, object_id: str) -> Optional[DigitalObject]:
        if not object_id:
            return None
        hit = self.assets.get(object_id)
        if hit:
            return hit
        row = self._conn.execute(
            "SELECT * FROM objects WHERE object_id = ?", (object_id,)
        ).fetchone()
        if not row:
            return None
        obj = self._row_to_obj(row)
        self.assets[obj.object_id] = obj
        return obj

    def by_cid(self, manifest_cid: str) -> List[DigitalObject]:
        rows = self._conn.execute(
            "SELECT * FROM objects WHERE manifest_cid = ? ORDER BY created_at",
            (manifest_cid,),
        ).fetchall()
        return [self._row_to_obj(r) for r in rows]

    def by_owner(self, owner: str) -> List[DigitalObject]:
        rows = self._conn.execute(
            "SELECT * FROM objects WHERE owner = ? ORDER BY created_at",
            (owner,),
        ).fetchall()
        return [self._row_to_obj(r) for r in rows]

    def list(self, limit: int = 50) -> List[DigitalObject]:
        rows = self._conn.execute(
            "SELECT * FROM objects ORDER BY created_at DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
        return [self._row_to_obj(r) for r in rows]

    def transfer(self, object_id: str, new_owner: str) -> DigitalObject:
        a = self.get(object_id)
        if not a:
            raise KeyError("object not found")
        new_owner = (new_owner or "").strip()
        if not new_owner:
            raise ValueError("new_owner required")
        a.owner = new_owner
        a.updated_at = time.time()
        tx = self._attach_dag_tx(new_owner, a.manifest_cid, "object_transfer")
        if tx:
            a.dag_tx = tx
        self._persist(a)
        return a

    def summary(self) -> dict:
        items = self.list(50)
        return {
            "total": len(self.assets) or self._count(),
            "oracle_live": ORACLE_LIVE,
            "assets": [o.to_dict() for o in items],
        }

    def _count(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) AS n FROM objects").fetchone()
        return int(row["n"] if row else 0)

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass


NFTRegistry = ObjectRegistry


def layers_payload(obj: DigitalObject, parts_listed=None) -> dict:
    return {
        "cid": {
            "manifest_cid": obj.manifest_cid,
            "parts": parts_listed if parts_listed is not None else obj.parts,
        },
        "dag": {"vertex": obj.dag_tx, "tx_type": "object_compose"},
        "nft": {"id": obj.object_id, "note": "object_id is network identity; not the CID"},
        "strata": {
            "collateral_strata": 0,
            "strata_units": 0,
            "reserved": True,
            "oracle_live": False,
        },
    }


def demo():
    import tempfile

    path = tempfile.mktemp(suffix=".db")
    r = ObjectRegistry(db_path=path)
    a = r.mint(DEFAULT_OWNER, "bafy-nft-demo", title="Genesis Object", renderer="none")
    r.transfer(a.object_id, "EDGE-01")
    print(r.summary())
    print("object registry demo OK", a.object_id)
    r.close()


if __name__ == "__main__":
    demo()
