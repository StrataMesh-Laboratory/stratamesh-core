"""
StrataMesh IPFS Client — Phase 1/2
==================================
HTTP client for Kubo (go-ipfs) API and gateway fallbacks.

Modes:
  stub     — in-memory pin records (default, offline-safe)
  api      — POST /api/v0/pin/add against a Kubo node
  gateway  — HEAD/GET a public or private gateway (availability check only)

Env / constructor:
  IPFS_API_URL   e.g. http://127.0.0.1:5001
  IPFS_GATEWAY   e.g. https://ipfs.io  or Cloudflare gateway
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Optional
import os
import time
import json
import urllib.request
import urllib.error
import urllib.parse


@dataclass
class PinRecord:
    cid: str
    requested_at: float
    status: str = "queued"  # queued | pinning | pinned | failed | available
    last_error: Optional[str] = None
    mode: str = "stub"


class IPFSClient:
    def __init__(
        self,
        mode: Optional[str] = None,
        api_url: Optional[str] = None,
        gateway: Optional[str] = None,
        timeout: float = 15.0,
        db_path: Optional[str] = None,
    ):
        self.api_url = (api_url or os.environ.get("IPFS_API_URL") or "").rstrip("/")
        self.gateway = (gateway or os.environ.get("IPFS_GATEWAY") or "https://ipfs.io").rstrip("/")
        self.timeout = timeout
        if mode:
            self.mode = mode
        elif self.api_url:
            self.mode = "api"
        else:
            self.mode = "stub"
        self.pins: Dict[str, PinRecord] = {}
        self.db_path = db_path or os.environ.get("FOG_SQLITE_PATH") or None
        self._conn = None
        if self.db_path:
            self._init_pin_db()


    def _init_pin_db(self) -> None:
        import sqlite3
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(
            """CREATE TABLE IF NOT EXISTS ipfs_pins (
                cid TEXT PRIMARY KEY,
                status TEXT,
                mode TEXT,
                requested_at REAL,
                last_error TEXT
            )"""
        )
        self._conn.commit()
        self._load_pins()

    def _load_pins(self) -> None:
        if not self._conn:
            return
        rows = self._conn.execute("SELECT * FROM ipfs_pins").fetchall()
        for r in rows:
            self.pins[r["cid"]] = PinRecord(
                cid=r["cid"],
                requested_at=float(r["requested_at"] or 0),
                status=r["status"] or "queued",
                last_error=r["last_error"],
                mode=r["mode"] or self.mode,
            )

    def _persist_pin(self, rec: PinRecord) -> None:
        """Lab stub: persist pin records. Does not pretend a Kubo cluster."""
        if not self._conn:
            return
        self._conn.execute(
            """INSERT OR REPLACE INTO ipfs_pins
               (cid, status, mode, requested_at, last_error)
               VALUES (?, ?, ?, ?, ?)""",
            (rec.cid, rec.status, rec.mode, rec.requested_at, rec.last_error),
        )
        self._conn.commit()

    def request_pin(self, cid: str) -> PinRecord:
        if not cid:
            raise ValueError("empty cid")
        if cid in self.pins and self.pins[cid].status in ("pinned", "available"):
            return self.pins[cid]

        rec = PinRecord(cid=cid, requested_at=time.time(), status="pinning", mode=self.mode)
        self.pins[cid] = rec

        if self.mode == "stub":
            rec.status = "pinned"
            self._persist_pin(rec)
            return rec

        if self.mode == "api":
            rec = self._pin_via_api(rec)
            self._persist_pin(rec)
            return rec

        if self.mode == "gateway":
            rec = self._check_gateway(rec)
            self._persist_pin(rec)
            return rec

        rec.status = "failed"
        rec.last_error = f"unknown mode {self.mode}"
        self._persist_pin(rec)
        return rec

    def _pin_via_api(self, rec: PinRecord) -> PinRecord:
        # Kubo: POST /api/v0/pin/add?arg=<cid>
        url = f"{self.api_url}/api/v0/pin/add?arg={urllib.parse.quote(rec.cid)}"
        try:
            req = urllib.request.Request(url, method="POST", data=b"")
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode()
                # response typically {"Pins":["cid"]}
                rec.status = "pinned"
                try:
                    data = json.loads(body)
                    if "Pins" not in data and "Error" in str(data):
                        rec.status = "failed"
                        rec.last_error = body[:200]
                except Exception:
                    pass
        except urllib.error.HTTPError as e:
            rec.status = "failed"
            rec.last_error = f"HTTP {e.code}: {e.reason}"
        except Exception as e:
            rec.status = "failed"
            rec.last_error = str(e)
            # fall back: try gateway presence
            gw = self._check_gateway(PinRecord(cid=rec.cid, requested_at=rec.requested_at, mode="gateway"))
            if gw.status == "available":
                rec.status = "available"
                rec.last_error = f"api failed ({rec.last_error}); gateway sees CID"
        return rec

    def _check_gateway(self, rec: PinRecord) -> PinRecord:
        url = f"{self.gateway}/ipfs/{rec.cid}"
        try:
            req = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                if 200 <= resp.status < 400:
                    rec.status = "available"
                else:
                    rec.status = "failed"
                    rec.last_error = f"gateway status {resp.status}"
        except urllib.error.HTTPError as e:
            # Some gateways disallow HEAD; try GET range
            if e.code in (400, 405, 501):
                try:
                    req = urllib.request.Request(url, method="GET")
                    req.add_header("Range", "bytes=0-0")
                    with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                        rec.status = "available" if resp.status in (200, 206) else "failed"
                except Exception as e2:
                    rec.status = "failed"
                    rec.last_error = str(e2)
            else:
                rec.status = "failed"
                rec.last_error = f"HTTP {e.code}"
        except Exception as e:
            rec.status = "failed"
            rec.last_error = str(e)
        return rec

    def status(self, cid: str) -> Optional[PinRecord]:
        return self.pins.get(cid)

    def summary(self) -> dict:
        counts: Dict[str, int] = {}
        for r in self.pins.values():
            counts[r.status] = counts.get(r.status, 0) + 1
        return {
            "mode": self.mode,
            "api_url": self.api_url or None,
            "gateway": self.gateway,
            "total": len(self.pins),
            "by_status": counts,
        }


# Back-compat alias used by older call sites
PinStub = IPFSClient


def demo():
    print("--- stub mode ---")
    c = IPFSClient(mode="stub")
    print(c.request_pin("bafybeig-demo-stub"))
    print(c.summary())

    print("--- gateway mode (ipfs.io well-known CID) ---")
    # empty directory CID often used in docs
    known = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi"
    g = IPFSClient(mode="gateway", gateway="https://ipfs.io")
    rec = g.request_pin(known)
    print(rec)
    print(g.summary())
    print("IPFS client demo done")


if __name__ == "__main__":
    demo()
