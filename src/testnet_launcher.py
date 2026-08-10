"""
StrataMesh Private Testnet Launcher — Phase 1
=============================================
Starts N persistent Fog Nodes on consecutive ports and runs a short
gossip/load cycle against them.

Usage:
    python3 testnet_launcher.py --nodes 3 --base-port 8787 --rounds 10
"""

from __future__ import annotations
import argparse
import subprocess
import time
import sys
import os
import signal
import json
import urllib.request


def post_json(url: str, data: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read().decode())


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=5) as r:
        return json.loads(r.read().decode())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=int, default=3)
    parser.add_argument("--base-port", type=int, default=8787)
    parser.add_argument("--rounds", type=int, default=8)
    args = parser.parse_args()

    procs = []
    ports = []
    script = os.path.join(os.path.dirname(__file__), "node_persistent.py")

    print(f"Launching {args.nodes} persistent Fog Nodes...")
    for i in range(args.nodes):
        port = args.base_port + i
        db = f"/tmp/stratamesh-testnet-{i}.db"
        if os.path.exists(db):
            os.remove(db)
        p = subprocess.Popen(
            [sys.executable, script, "--port", str(port), "--db", db, "--id", f"FOG-TEST-{i:02d}"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        procs.append(p)
        ports.append(port)
        print(f"  FOG-TEST-{i:02d} → :{port}  db={db}")

    time.sleep(1.2)

    try:
        print("\nSubmitting transactions...")
        for r in range(args.rounds):
            for port in ports:
                t = "lightweight" if r % 3 == 0 else "standard"
                try:
                    post_json(f"http://127.0.0.1:{port}/submit", {"type": t})
                except Exception as e:
                    print(f"  submit error :{port}: {e}")
            time.sleep(0.15)

        print("\nFinal status:")
        print(f"{'Node':<12} {'Port':>6} {'TXs':>6} {'Tips':>6}")
        print("-" * 35)
        for i, port in enumerate(ports):
            try:
                st = get_json(f"http://127.0.0.1:{port}/status")
                dag = st["dag"]
                print(f"FOG-TEST-{i:02d}  {port:>6} {dag['transaction_count']:>6} {dag['tip_count']:>6}")
            except Exception as e:
                print(f"FOG-TEST-{i:02d}  error: {e}")
    finally:
        print("\nStopping nodes...")
        for p in procs:
            p.send_signal(signal.SIGTERM)
        for p in procs:
            p.wait(timeout=3)
        print("Done.")


if __name__ == "__main__":
    main()
