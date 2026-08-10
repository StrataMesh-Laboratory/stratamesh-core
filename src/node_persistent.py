"""
StrataMesh Persistent Fog Node — Phase 2
========================================
HTTP Fog Node: PersistentDAG, gossip, pins, SPA registry, finality, PoC.

Endpoints:
  GET  /status /health /inv /spa /finality /contribution
  POST /submit /gossip /spa/register
"""

from __future__ import annotations
import argparse
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from persistent_dag import PersistentDAG
from tip_selection import Transaction, TxType
from gossip import GossipNode
from cid_pin_stub import PinStub
from spa_registry import SPARegistry
from finality import tip_set_report, tip_confidence
from contribution import ContributionLedger
from metrics_bridge import build_status_payload
from subsistence.runtime import SubsistenceRuntime


class PersistentFogNode:
    def __init__(self, node_id: str = "FOG-NODE-PT-CM-001", db_path: str = "/tmp/stratamesh-fog.db"):
        self.node_id = node_id
        self.dag = PersistentDAG(db_path)
        self.gossip = GossipNode(self.dag)
        self.pinner = PinStub()
        self.spas = SPARegistry(self.dag)
        self.poc = ContributionLedger()
        self.subsistence = SubsistenceRuntime()
        self.subsistence.register(node_id, reserve=10.0, tau=0.0)
        self.started_at = time.time()
        self.lock = threading.Lock()
        self.db_path = db_path

    def submit(self, tx_type: str = "standard", cid: str | None = None) -> dict:
        with self.lock:
            parents = self.dag.select_tips(k=2)
            t = TxType.LIGHTWEIGHT if tx_type == "lightweight" else TxType.STANDARD
            tx = Transaction(
                tx_id=Transaction.make_id(str(time.time()), str(len(self.dag.txs))),
                tx_type=t,
                parents=parents,
                weight=1.0,
                cid=cid,
            )
            ok = self.dag.attach(tx)
            pin_status = None
            if ok and cid:
                pin_status = self.pinner.request_pin(cid).status
            if ok:
                self.poc.record(self.node_id, "validation", units=1.0)
                self.subsistence.earn(self.node_id, compute=0.5)
            self.subsistence.consume(self.node_id, compute=0.1)
            return {
                "accepted": ok,
                "tx_id": tx.tx_id,
                "type": t.value,
                "parents": parents,
                "cid": cid,
                "pin_status": pin_status,
                "confidence": tip_confidence(self.dag, tx.tx_id) if ok else 0.0,
            }

    def register_spa(self, roles: list, service_level: dict | None = None, cid: str | None = None) -> dict:
        with self.lock:
            rec = self.spas.register(
                provider_id=self.node_id,
                roles=roles or ["fog"],
                service_level=service_level,
                cid=cid,
            )
            self.poc.record(self.node_id, "spa_uptime", units=5.0, spa_id=rec.spa_id)
            return {
                "spa_id": rec.spa_id,
                "tx_id": rec.tx_id,
                "roles": rec.roles,
                "active": rec.active,
            }

    def handle_gossip(self, raw: bytes) -> list:
        with self.lock:
            replies = self.gossip.handle_message(raw)
            if replies:
                self.poc.record(self.node_id, "gossip", units=0.2)
            return replies

    def inventory(self) -> list:
        with self.lock:
            return list(self.dag.txs.keys())[-64:]

    def status(self) -> dict:
        with self.lock:
            stats = self.dag.stats()
            sub = self.subsistence.ledger.report(self.node_id)
            return build_status_payload(
                node_id=self.node_id,
                dag_stats=stats,
                spa_summary=self.spas.summary(),
                subsistence=sub,
                phase="2",
                phase_name="Nodal Hierarchy & SPAs",
                extra={
                    "version": "0.2.1-dev",
                    "uptime_seconds": int(time.time() - self.started_at),
                    "storage": {"backend": "sqlite", "path": self.db_path},
                    "finality_tips": tip_set_report(self.dag, limit=8),
                    "contribution": self.poc.summary(),
                    "ipfs": {
                        "dnslink_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi",
                        "pins": self.pinner.summary(),
                    },
                },
            )


NODE: PersistentFogNode | None = None


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj):
        if isinstance(obj, (bytes, bytearray)):
            body, ctype = obj, "application/octet-stream"
        else:
            body = json.dumps(obj, indent=2).encode()
            ctype = "application/json"
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/status", "/v1/status"):
            self._json(200, NODE.status())
        elif path == "/health":
            self._json(200, {"ok": True})
        elif path == "/inv":
            self._json(200, {"ids": NODE.inventory()})
        elif path == "/spa":
            self._json(200, NODE.spas.summary())
        elif path == "/finality":
            with NODE.lock:
                self._json(200, {"tips": tip_set_report(NODE.dag)})
        elif path == "/contribution":
            self._json(200, NODE.poc.summary())
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"

        if path == "/submit":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            self._json(200, NODE.submit(data.get("type", "standard"), data.get("cid")))

        elif path == "/spa/register":
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            try:
                result = NODE.register_spa(
                    roles=data.get("roles") or ["fog"],
                    service_level=data.get("service_level"),
                    cid=data.get("cid"),
                )
                self._json(200, result)
            except Exception as e:
                self._json(400, {"error": str(e)})

        elif path == "/gossip":
            import base64
            replies = NODE.handle_gossip(raw)
            out = [base64.b64encode(r).decode() for r in replies]
            self._json(200, {"replies": out, "count": len(out)})

        else:
            self._json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        print(f"[node] {fmt % args}")


def main():
    global NODE
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--db", default="/tmp/stratamesh-fog.db")
    parser.add_argument("--id", default="FOG-NODE-PT-CM-001")
    args = parser.parse_args()

    NODE = PersistentFogNode(node_id=args.id, db_path=args.db)
    server = HTTPServer(("0.0.0.0", args.port), Handler)
    print(f"Persistent Fog Node {args.id} on :{args.port}  db={args.db}")
    print("  GET /status /spa /finality /contribution /inv")
    print("  POST /submit /spa/register /gossip")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        NODE.dag.close()


if __name__ == "__main__":
    main()
