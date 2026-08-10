"""
StrataMesh Gossip Testnet — Phase 1
===================================
Launches N persistent nodes and synchronises them via the /gossip HTTP API
(INV → GETDATA → TX), demonstrating missing-parent resolution across processes.

Usage:
    python3 gossip_testnet.py --nodes 3 --base-port 8800 --rounds 5
"""

from __future__ import annotations
import argparse
import subprocess
import sys
import os
import time
import signal
import json
import base64
import urllib.request
from gossip import make_inv, make_getdata, decode, MsgType


def http_json(method: str, url: str, data: dict | None = None, raw: bytes | None = None) -> dict:
    body = raw if raw is not None else (json.dumps(data or {}).encode() if data is not None else None)
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json" if raw is None else "application/octet-stream"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read().decode())


def post_gossip(port: int, raw: bytes) -> list:
    """Send raw gossip message; return list of reply raw bytes."""
    resp = http_json("POST", f"http://127.0.0.1:{port}/gossip", raw=raw)
    return [base64.b64decode(x) for x in resp.get("replies", [])]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=int, default=3)
    parser.add_argument("--base-port", type=int, default=8800)
    parser.add_argument("--rounds", type=int, default=5)
    args = parser.parse_args()

    script = os.path.join(os.path.dirname(__file__), "node_persistent.py")
    procs = []
    ports = []

    print(f"Starting {args.nodes} nodes...")
    for i in range(args.nodes):
        port = args.base_port + i
        db = f"/tmp/gossip-net-{i}.db"
        if os.path.exists(db):
            os.remove(db)
        p = subprocess.Popen(
            [sys.executable, script, "--port", str(port), "--db", db, "--id", f"GNODE-{i:02d}"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        procs.append(p)
        ports.append(port)
        print(f"  GNODE-{i:02d} :{port}")

    time.sleep(1.0)

    try:
        # Each node submits local txs
        print("\nLocal submits...")
        for r in range(args.rounds):
            for port in ports:
                http_json("POST", f"http://127.0.0.1:{port}/submit", {
                    "type": "lightweight" if r % 2 == 0 else "standard",
                    "cid": f"bafy-g-{port}-{r}" if r % 3 == 0 else None,
                })
            time.sleep(0.1)

        # Gossip sync: each node announces INV to others
        print("Gossip sync rounds...")
        for _ in range(4):
            for src in ports:
                inv = http_json("GET", f"http://127.0.0.1:{src}/inv")
                raw_inv = make_inv(inv.get("ids", []))
                for dst in ports:
                    if dst == src:
                        continue
                    replies = post_gossip(dst, raw_inv)
                    # deliver replies back to src (and follow-up)
                    for rep in replies:
                        more = post_gossip(src, rep)
                        for m in more:
                            post_gossip(dst, m)
            time.sleep(0.15)

        print("\nFinal state:")
        print(f"{'Node':<10} {'Port':>6} {'TXs':>6} {'Tips':>6} {'Pins':>6}")
        print("-" * 40)
        for i, port in enumerate(ports):
            st = http_json("GET", f"http://127.0.0.1:{port}/status")
            dag = st["dag"]
            pins = st.get("ipfs", {}).get("pins", {}).get("total", 0)
            print(f"GNODE-{i:02d}  {port:>6} {dag['transaction_count']:>6} {dag['tip_count']:>6} {pins:>6}")

    finally:
        for p in procs:
            p.send_signal(signal.SIGTERM)
        for p in procs:
            try:
                p.wait(timeout=3)
            except Exception:
                p.kill()
        print("\nStopped.")


if __name__ == "__main__":
    main()
