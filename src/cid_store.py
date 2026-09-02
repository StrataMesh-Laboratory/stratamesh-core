"""CID-only store — persist content identity without minting an NFT/object_id.

Same Fog sqlite as ObjectRegistry (FOG_SQLITE_PATH). No STRATA. No workers.dev.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Any, Dict, Optional

DEFAULT_SQLITE = os.environ.get("FOG_SQLITE_PATH") or "/tmp/stratamesh-fog.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS cid_store (
    cid TEXT PRIMARY KEY,
    payload_json TEXT,
    created_at REAL
);
"""


def _conn(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or os.environ.get("FOG_SQLITE_PATH") or DEFAULT_SQLITE
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def put_cid(cid: str, payload: Any = None, db_path: Optional[str] = None) -> Dict[str, Any]:
    cid = (cid or "").strip()
    if not cid:
        raise ValueError("cid required")
    now = time.time()
    blob = json.dumps(payload if payload is not None else {}, separators=(",", ":"), sort_keys=True)
    conn = _conn(db_path)
    try:
        conn.execute(
            "INSERT OR REPLACE INTO cid_store (cid, payload_json, created_at) VALUES (?, ?, ?)",
            (cid, blob, now),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "cid": cid, "created_at": now, "payload": payload if payload is not None else {}}


def get_cid(cid: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    cid = (cid or "").strip()
    if not cid:
        return None
    conn = _conn(db_path)
    try:
        row = conn.execute("SELECT cid, payload_json, created_at FROM cid_store WHERE cid = ?", (cid,)).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    payload = {}
    try:
        payload = json.loads(row["payload_json"] or "{}")
    except Exception:
        payload = {}
    return {"ok": True, "cid": row["cid"], "payload": payload, "created_at": float(row["created_at"] or 0)}
