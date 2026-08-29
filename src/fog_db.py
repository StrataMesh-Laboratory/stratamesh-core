"""Fog MariaDB DSN adapter — optional exclusive-off LAB.

Missing FOG_MYSQL_URL keeps today's SQLite path identical
(PersistentDAG tables `transactions` + `meta` only). Connect failure
also falls back to SQLite. Import has no side effects: no connect,
no schema, no liboqs.

GET /health must not import this module and must not open MariaDB.
GET /status must not auto-build liboqs (this module never imports pq_keys).

n=1, oracle_live=false, no mesh claim.
No Worker / D1 / KV / R2 / RDS / workers.dev.
grok@ is GRANT fog_cmn.* only — this module never CREATE DATABASE or GRANT.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Any, Dict, Optional
from urllib.parse import unquote, urlparse

# Today's PersistentDAG SQLite schema (src/persistent_dag.py). Exclusive-off
# SQLite path creates only these two tables — identical to current Fog.
SQLITE_DAG_SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    tx_id TEXT PRIMARY KEY,
    tx_type TEXT NOT NULL,
    parents TEXT NOT NULL,
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
"""

# MariaDB 1:1 tables. Must stay in sync with fog_cmn.mariadb.sql.
# No CREATE DATABASE / GRANT (grok is not root).
MARIADB_SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS transactions (
      tx_id VARCHAR(128) NOT NULL,
      tx_type VARCHAR(64) NOT NULL,
      parents TEXT NOT NULL,
      weight DOUBLE NOT NULL,
      cumulative_weight DOUBLE NOT NULL,
      timestamp DOUBLE NOT NULL,
      cid VARCHAR(256) NULL,
      sender VARCHAR(256) NULL,
      PRIMARY KEY (tx_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS meta (
      `key` VARCHAR(128) NOT NULL,
      value TEXT NULL,
      PRIMARY KEY (`key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS staff (
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NULL,
      staff_role VARCHAR(64) NOT NULL,
      clearance VARCHAR(64) NOT NULL,
      is_root_admin TINYINT(1) NOT NULL DEFAULT 0,
      is_sca TINYINT(1) NOT NULL DEFAULT 0,
      mariadb_user VARCHAR(64) NULL,
      note TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS staff_otp (
      id BIGINT NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      challenge VARCHAR(128) NOT NULL,
      code_hash VARCHAR(128) NOT NULL,
      expires_at DOUBLE NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_staff_otp_email (email),
      KEY idx_staff_otp_challenge (challenge)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS subsistence_accounts (
      agent_id VARCHAR(128) NOT NULL,
      reserve DOUBLE NOT NULL DEFAULT 0,
      tau DOUBLE NOT NULL DEFAULT 0,
      grace_remaining INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      last_surplus DOUBLE NOT NULL DEFAULT 0,
      PRIMARY KEY (agent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS subsistence_meters (
      agent_id VARCHAR(128) NOT NULL,
      window_start DOUBLE NOT NULL,
      consumed_compute DOUBLE NOT NULL DEFAULT 0,
      consumed_memory_time DOUBLE NOT NULL DEFAULT 0,
      consumed_bandwidth DOUBLE NOT NULL DEFAULT 0,
      consumed_energy DOUBLE NOT NULL DEFAULT 0,
      consumed_other DOUBLE NOT NULL DEFAULT 0,
      earned_compute DOUBLE NOT NULL DEFAULT 0,
      earned_memory_time DOUBLE NOT NULL DEFAULT 0,
      earned_bandwidth DOUBLE NOT NULL DEFAULT 0,
      earned_energy DOUBLE NOT NULL DEFAULT 0,
      earned_other DOUBLE NOT NULL DEFAULT 0,
      PRIMARY KEY (agent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS subsistence_log (
      id BIGINT NOT NULL AUTO_INCREMENT,
      agent_id VARCHAR(128) NOT NULL,
      kind VARCHAR(32) NOT NULL,
      amount DOUBLE NOT NULL DEFAULT 0,
      detail TEXT NULL,
      ts DOUBLE NOT NULL,
      PRIMARY KEY (id),
      KEY idx_subsistence_log_agent (agent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS gossip_pending (
      tx_id VARCHAR(128) NOT NULL,
      tx_type VARCHAR(64) NOT NULL,
      parents TEXT NOT NULL,
      weight DOUBLE NOT NULL,
      cumulative_weight DOUBLE NOT NULL,
      timestamp DOUBLE NOT NULL,
      cid VARCHAR(256) NULL,
      sender VARCHAR(256) NULL,
      PRIMARY KEY (tx_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS gossip_messages (
      id BIGINT NOT NULL AUTO_INCREMENT,
      msg_type VARCHAR(32) NOT NULL,
      payload TEXT NOT NULL,
      ts DOUBLE NOT NULL,
      PRIMARY KEY (id),
      KEY idx_gossip_messages_ts (ts)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
)

DEFAULT_SQLITE_PATH = "/tmp/stratamesh-fog.db"
CONNECT_TIMEOUT_SEC = 2


def health_payload() -> dict:
    """GET /health body. Never imports/connects MariaDB. Never touches liboqs."""
    return {"ok": True}


def mysql_url_configured() -> bool:
    return bool((os.environ.get("FOG_MYSQL_URL") or "").strip())


def sqlite_path(override: Optional[str] = None) -> str:
    if override:
        return override
    return os.environ.get("FOG_SQLITE_PATH") or DEFAULT_SQLITE_PATH


def redact_dsn(url: str) -> str:
    try:
        u = urlparse(url)
        host = u.hostname or ""
        port = u.port or 3306
        user = u.username or ""
        db = (u.path or "/").lstrip("/")
        return f"{u.scheme}://{user}@{host}:{port}/{db}"
    except Exception:
        return "mysql://<redacted>"


def parse_dsn(url: str) -> Dict[str, Any]:
    """Parse mysql://user[:pass]@host:port/db. Password never logged.

    If the URL has no password, STAFF_GROK_PASSWORD is used when present.
    """
    u = urlparse(url)
    if u.scheme not in ("mysql", "mariadb"):
        raise ValueError("FOG_MYSQL_URL scheme must be mysql or mariadb")
    password = unquote(u.password) if u.password else (
        os.environ.get("STAFF_GROK_PASSWORD") or ""
    )
    return {
        "host": u.hostname or "127.0.0.1",
        "port": int(u.port or 3306),
        "user": unquote(u.username) if u.username else "grok",
        "password": password,
        "database": ((u.path or "/").lstrip("/") or "fog_cmn"),
    }


def try_mysql(url: str, timeout: float = CONNECT_TIMEOUT_SEC):
    """Return a pymysql connection or None. Never raises to the caller."""
    try:
        import pymysql  # type: ignore
    except Exception:
        return None
    try:
        cfg = parse_dsn(url)
    except Exception:
        return None
    try:
        t = max(0.2, float(timeout))
        return pymysql.connect(
            host=cfg["host"],
            port=cfg["port"],
            user=cfg["user"],
            password=cfg["password"],
            database=cfg["database"],
            charset="utf8mb4",
            autocommit=True,
            connect_timeout=t,
            read_timeout=t,
            write_timeout=t,
        )
    except Exception:
        return None


def apply_mariadb_schema(conn) -> None:
    cur = conn.cursor()
    try:
        for stmt in MARIADB_SCHEMA_STATEMENTS:
            cur.execute(stmt)
    finally:
        cur.close()


class FogStore:
    """Thin store. SQLite backend = today's DAG path. MariaDB = 1:1 fog_cmn."""

    def __init__(
        self,
        *,
        backend: str,
        conn: Any,
        sqlite_path: str,
        mysql_fallback: bool = False,
        dsn_redacted: Optional[str] = None,
    ):
        self.backend = backend
        self.conn = conn
        self.path = sqlite_path
        self.mysql_fallback = mysql_fallback
        self.dsn_redacted = dsn_redacted
        self.lab = True
        self.n = 1
        self.oracle_live = False
        self.mesh_member = False

    def storage_status(self) -> dict:
        out = {
            "backend": self.backend,
            "path": self.path,
            "lab": True,
            "n": 1,
            "oracle_live": False,
            "mesh_member": False,
        }
        if self.backend == "mariadb":
            out["dsn"] = self.dsn_redacted
            out["database"] = "fog_cmn"
        if self.mysql_fallback:
            out["mysql_fallback"] = True
        return out

    def persist_transaction(self, row: Dict[str, Any]) -> None:
        parents = row.get("parents")
        if not isinstance(parents, str):
            parents = json.dumps(parents or [])
        if self.backend == "sqlite":
            self.conn.execute(
                """INSERT OR REPLACE INTO transactions
                   (tx_id, tx_type, parents, weight, cumulative_weight, timestamp, cid, sender)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    row["tx_id"],
                    row.get("tx_type") or "standard",
                    parents,
                    float(row.get("weight") or 1.0),
                    float(row.get("cumulative_weight") or 1.0),
                    float(row.get("timestamp") or time.time()),
                    row.get("cid"),
                    row.get("sender"),
                ),
            )
            self.conn.commit()
            return
        cur = self.conn.cursor()
        cur.execute(
            """INSERT INTO transactions
               (tx_id, tx_type, parents, weight, cumulative_weight, timestamp, cid, sender)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
               ON DUPLICATE KEY UPDATE
                 tx_type=VALUES(tx_type), parents=VALUES(parents),
                 weight=VALUES(weight), cumulative_weight=VALUES(cumulative_weight),
                 timestamp=VALUES(timestamp), cid=VALUES(cid), sender=VALUES(sender)""",
            (
                row["tx_id"],
                row.get("tx_type") or "standard",
                parents,
                float(row.get("weight") or 1.0),
                float(row.get("cumulative_weight") or 1.0),
                float(row.get("timestamp") or time.time()),
                row.get("cid"),
                row.get("sender"),
            ),
        )
        cur.close()

    def persist_meta(self, key: str, value: Optional[str]) -> None:
        if self.backend == "sqlite":
            self.conn.execute(
                "INSERT OR REPLACE INTO meta (`key`, value) VALUES (?, ?)",
                (key, value),
            )
            self.conn.commit()
            return
        cur = self.conn.cursor()
        cur.execute(
            "INSERT INTO meta (`key`, value) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE value=VALUES(value)",
            (key, value),
        )
        cur.close()

    def persist_staff(self, row: Dict[str, Any]) -> None:
        if self.backend != "mariadb":
            return
        cur = self.conn.cursor()
        cur.execute(
            """INSERT INTO staff
               (email, password_hash, staff_role, clearance, is_root_admin, is_sca, mariadb_user, note)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
               ON DUPLICATE KEY UPDATE
                 password_hash=VALUES(password_hash), staff_role=VALUES(staff_role),
                 clearance=VALUES(clearance), is_root_admin=VALUES(is_root_admin),
                 is_sca=VALUES(is_sca), mariadb_user=VALUES(mariadb_user), note=VALUES(note)""",
            (
                row["email"],
                row.get("password_hash"),
                row.get("staff_role") or "admin",
                row.get("clearance") or "SECRET",
                1 if row.get("is_root_admin") else 0,
                1 if row.get("is_sca") else 0,
                row.get("mariadb_user"),
                row.get("note"),
            ),
        )
        cur.close()

    def persist_staff_otp(self, row: Dict[str, Any]) -> None:
        if self.backend != "mariadb":
            return
        cur = self.conn.cursor()
        cur.execute(
            """INSERT INTO staff_otp
               (email, challenge, code_hash, expires_at, used)
               VALUES (%s,%s,%s,%s,%s)""",
            (
                row["email"],
                row["challenge"],
                row["code_hash"],
                float(row["expires_at"]),
                1 if row.get("used") else 0,
            ),
        )
        cur.close()

    def persist_subsistence_account(self, row: Dict[str, Any]) -> None:
        if self.backend != "mariadb":
            return
        cur = self.conn.cursor()
        cur.execute(
            """INSERT INTO subsistence_accounts
               (agent_id, reserve, tau, grace_remaining, status, last_surplus)
               VALUES (%s,%s,%s,%s,%s,%s)
               ON DUPLICATE KEY UPDATE
                 reserve=VALUES(reserve), tau=VALUES(tau),
                 grace_remaining=VALUES(grace_remaining), status=VALUES(status),
                 last_surplus=VALUES(last_surplus)""",
            (
                row["agent_id"],
                float(row.get("reserve") or 0.0),
                float(row.get("tau") or 0.0),
                int(row.get("grace_remaining") or 0),
                row.get("status") or "active",
                float(row.get("last_surplus") or 0.0),
            ),
        )
        cur.close()

    def persist_subsistence_meter(self, row: Dict[str, Any]) -> None:
        if self.backend != "mariadb":
            return
        consumed = row.get("consumed") or {}
        earned = row.get("earned") or {}
        cur = self.conn.cursor()
        cur.execute(
            """INSERT INTO subsistence_meters
               (agent_id, window_start,
                consumed_compute, consumed_memory_time, consumed_bandwidth,
                consumed_energy, consumed_other,
                earned_compute, earned_memory_time, earned_bandwidth,
                earned_energy, earned_other)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON DUPLICATE KEY UPDATE
                 window_start=VALUES(window_start),
                 consumed_compute=VALUES(consumed_compute),
                 consumed_memory_time=VALUES(consumed_memory_time),
                 consumed_bandwidth=VALUES(consumed_bandwidth),
                 consumed_energy=VALUES(consumed_energy),
                 consumed_other=VALUES(consumed_other),
                 earned_compute=VALUES(earned_compute),
                 earned_memory_time=VALUES(earned_memory_time),
                 earned_bandwidth=VALUES(earned_bandwidth),
                 earned_energy=VALUES(earned_energy),
                 earned_other=VALUES(earned_other)""",
            (
                row["agent_id"],
                float(row.get("window_start") or time.time()),
                float(consumed.get("compute") or 0.0),
                float(consumed.get("memory_time") or 0.0),
                float(consumed.get("bandwidth") or 0.0),
                float(consumed.get("energy") or 0.0),
                float(consumed.get("other") or 0.0),
                float(earned.get("compute") or 0.0),
                float(earned.get("memory_time") or 0.0),
                float(earned.get("bandwidth") or 0.0),
                float(earned.get("energy") or 0.0),
                float(earned.get("other") or 0.0),
            ),
        )
        cur.close()

    def persist_subsistence_log(self, row: Dict[str, Any]) -> None:
        if self.backend != "mariadb":
            return
        detail = row.get("detail")
        if not isinstance(detail, str):
            detail = json.dumps(detail or {})
        cur = self.conn.cursor()
        cur.execute(
            """INSERT INTO subsistence_log (agent_id, kind, amount, detail, ts)
               VALUES (%s,%s,%s,%s,%s)""",
            (
                row["agent_id"],
                row.get("kind") or "status",
                float(row.get("amount") or 0.0),
                detail,
                float(row.get("ts") or time.time()),
            ),
        )
        cur.close()

    def persist_gossip_pending(self, row: Dict[str, Any]) -> None:
        if self.backend != "mariadb":
            return
        parents = row.get("parents")
        if not isinstance(parents, str):
            parents = json.dumps(parents or [])
        cur = self.conn.cursor()
        cur.execute(
            """INSERT INTO gossip_pending
               (tx_id, tx_type, parents, weight, cumulative_weight, timestamp, cid, sender)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
               ON DUPLICATE KEY UPDATE
                 tx_type=VALUES(tx_type), parents=VALUES(parents),
                 weight=VALUES(weight), cumulative_weight=VALUES(cumulative_weight),
                 timestamp=VALUES(timestamp), cid=VALUES(cid), sender=VALUES(sender)""",
            (
                row["tx_id"],
                row.get("tx_type") or "standard",
                parents,
                float(row.get("weight") or 1.0),
                float(row.get("cumulative_weight") or 1.0),
                float(row.get("timestamp") or time.time()),
                row.get("cid"),
                row.get("sender"),
            ),
        )
        cur.close()

    def persist_gossip_message(self, msg_type: str, payload: Any, ts: Optional[float] = None) -> None:
        if self.backend != "mariadb":
            return
        if not isinstance(payload, str):
            payload = json.dumps(payload)
        cur = self.conn.cursor()
        cur.execute(
            "INSERT INTO gossip_messages (msg_type, payload, ts) VALUES (%s,%s,%s)",
            (msg_type, payload, float(ts if ts is not None else time.time())),
        )
        cur.close()

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass


def open_store(
    sqlite_path_override: Optional[str] = None,
    mysql_timeout: float = CONNECT_TIMEOUT_SEC,
) -> FogStore:
    """Open MariaDB when FOG_MYSQL_URL connects; otherwise today's SQLite path.

    Never raises on a bad DSN / unreachable host. Exclusive-off: unset env
    uses SQLite and does not create staff/subsistence/gossip tables.
    """
    path = sqlite_path(sqlite_path_override)
    url = (os.environ.get("FOG_MYSQL_URL") or "").strip()
    if url:
        conn = try_mysql(url, timeout=mysql_timeout)
        if conn is not None:
            apply_mariadb_schema(conn)
            return FogStore(
                backend="mariadb",
                conn=conn,
                sqlite_path=path,
                dsn_redacted=redact_dsn(url),
            )
        # connect failed → SQLite fallback (health never depends on MariaDB)
        mysql_fallback = True
    else:
        mysql_fallback = False
    s = sqlite3.connect(path, check_same_thread=False)
    s.row_factory = sqlite3.Row
    s.executescript(SQLITE_DAG_SCHEMA)
    s.commit()
    return FogStore(
        backend="sqlite",
        conn=s,
        sqlite_path=path,
        mysql_fallback=mysql_fallback,
        dsn_redacted=redact_dsn(url) if url else None,
    )
