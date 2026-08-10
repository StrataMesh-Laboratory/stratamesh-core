"""
StrataMesh Persistent Fog Node — Phase 1
========================================
HTTP Fog Node backed by PersistentDAG (SQLite), with:
- Weighted tip selection
- CID pin stub on attach
- Gossip endpoint for INV/GETDATA/TX/missing-parent resolution

Run:
    python3 node_persistent.py --port 8787 --db /tmp/fog-node.db
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
from gossip import GossipNode, make_inv, make_tx, encode, MsgType
from cid_pin_stub import PinStub


class PersistentFogNode:
    def __init__(self, node_id: str = "FOG-NODE-PT-CM-001", db_path: str = "/tmp/stratamesh-fog.db"):
        self.node_id = node_id
        self.dag = PersistentDAG(db_path)
        self.gossip = GossipNode(self.dag)
        self.pinner = PinStub()
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
                rec = self.pinner.request_pin(cid)
                pin_status = rec.status
            return {
                "accepted": ok,
                "tx_id": tx.tx_id,
                "type": t.value,
                "parents": parents,
                "cid": cid,
                "pin_status": pin_status,
            }

    def handle_gossip(self, raw: bytes) -> list:
        with self.lock:
            return self.gossip.handle_message(raw)

    def inventory(self) -> list:
        with self.lock:
            return list(self.dag.txs.keys())[-64:]

    def status(self) -> dict:
        with self.lock:
            stats = self.dag.stats()
            pin_sum = self.pinner.summary()
            return {
                "node_id": self.node_id,
                "name": "Calhegas Morais (persistent)",
                "version": "0.1.2-dev",
                "phase": "1",
                "status": "running",
                "uptime_seconds": int(time.time() - self.started_at),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "storage": {"backend": "sqlite", "path": self.db_path},
                "dag": {
                    "transaction_count": stats["tx_count"],
                    "tip_count": stats["tip_count"],
                    "tips_sample": stats["tips"],
                    "pending_gossip": len(self.gossip.pending),
                },
                "ipfs": {
                    "dnslink_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi",
                    "pins": pin_sum,
                },
                "spa": {"active_spas": 0, "roles": ["fog"]},
            }


NODE: PersistentFogNode | None = None


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj):
        body = json.dumps(obj, indent=2).encode() if not isinstance(obj, (bytes, bytearray)) else obj
        if isinstance(obj, (bytes, bytearray)):
            body = obj
            ctype = "application/octet-stream"
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
            self._json(200, NODE.status())  # type: ignore
        elif path == "/health":
            self._json(200, {"ok": True})
        elif path == "/inv":
            self._json(200, {"ids": NODE.inventory()})  # type: ignore
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
            result = NODE.submit(  # type: ignore
                tx_type=data.get("type", "standard"),
                cid=data.get("cid"),
            )
            self._json(200, result)

        elif path == "/gossip":
            replies = NODE.handle_gossip(raw)  # type: ignore
            # return list of reply message bytes as base64-ish JSON for simplicity
            import base64
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
    print("  GET /status  GET /inv  POST /submit  POST /gossip")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        NODE.dag.close()


if __name__ == "__main__":
    main()
