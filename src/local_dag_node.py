"""
StrataMesh Local DAG Node — Phase 0 Simulation
==============================================
A single-process Fog Node simulator that:
- Maintains an in-memory DAG
- Accepts new transactions (standard + lightweight)
- Performs weighted tip selection
- Exposes a tiny HTTP status + submit API (stdlib only)
- Can be used as the seed for a private development testnet

Run:
    python3 local_dag_node.py [--port 8787]
"""

from __future__ import annotations
import argparse
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from tip_selection import DAG, Transaction, TxType


class FogNode:
    def __init__(self, node_id: str = "FOG-NODE-PT-CM-001"):
        self.node_id = node_id
        self.dag = DAG()
        self.dag.bootstrap()
        self.started_at = time.time()
        self.lock = threading.Lock()
        self.tx_count = 1  # genesis

    def submit(self, tx_type: str = "standard", cid: str | None = None) -> dict:
        with self.lock:
            parents = self.dag.select_tips(k=2)
            t = TxType.LIGHTWEIGHT if tx_type == "lightweight" else TxType.STANDARD
            tx = Transaction(
                tx_id=Transaction.make_id(str(self.tx_count), str(time.time())),
                tx_type=t,
                parents=parents,
                weight=1.0,
                cid=cid,
            )
            ok = self.dag.attach(tx)
            if ok:
                self.tx_count += 1
            return {
                "accepted": ok,
                "tx_id": tx.tx_id,
                "type": t.value,
                "parents": parents,
                "cid": cid,
            }

    def status(self) -> dict:
        with self.lock:
            stats = self.dag.stats()
            return {
                "node_id": self.node_id,
                "name": "Calhegas Morais (local simulation)",
                "version": "0.1.0-dev",
                "phase": "0",
                "status": "running",
                "uptime_seconds": int(time.time() - self.started_at),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "dag": {
                    "transaction_count": stats["tx_count"],
                    "tip_count": stats["tip_count"],
                    "tips_sample": stats["tips"],
                },
                "ipfs": {
                    "note": "simulation — real pinning not active",
                    "dnslink_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf4dfuylqabf3oclgtqy55fbzdi",
                },
                "spa": {"active_spas": 0, "roles": ["fog"]},
            }


NODE = FogNode()


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj: dict):
        body = json.dumps(obj, indent=2).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
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
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/submit":
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(raw.decode() or "{}")
            except Exception:
                data = {}
            result = NODE.submit(
                tx_type=data.get("type", "standard"),
                cid=data.get("cid"),
            )
            self._json(200, result)
        else:
            self._json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        print(f"[node] {self.address_string()} {fmt % args}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    server = HTTPServer(("0.0.0.0", args.port), Handler)
    print(f"StrataMesh local Fog Node simulation listening on :{args.port}")
    print(f"  GET  /status")
    print(f"  POST /submit   {{ \"type\": \"lightweight\"|\"standard\", \"cid\": \"...\" }}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")


if __name__ == "__main__":
    main()
