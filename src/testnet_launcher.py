"""
StrataMesh Private Testnet Launcher — Track A1
==============================================
Starts N persistent Fog Nodes, submits load, runs mesh gossip sync.

Usage:
    python3 testnet_launcher.py --nodes 3 --base-port 8790 --rounds 6 --sync-rounds 4
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
    parser.add_argument("--base-port", type=int, default=8790)
    parser.add_argument("--rounds", type=int, default=6)
    parser.add_argument("--sync-rounds", type=int, default=4)
    parser.add_argument("--keep", action="store_true", help="leave nodes running")
    args = parser.parse_args()

    procs = []
    ports = []
    script = os.path.join(os.path.dirname(__file__), "node_persistent.py")
    src_dir = os.path.dirname(__file__)

    print(f"Launching {args.nodes} Fog Nodes (A1 private mesh)...")
    for i in range(args.nodes):
        port = args.base_port + i
        db = f"/tmp/stratamesh-a1-{i}.db"
        if os.path.exists(db):
            os.remove(db)
        p = subprocess.Popen(
            [sys.executable, script, "--port", str(port), "--db", db, "--id", f"FOG-A1-{i:02d}"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=src_dir,
        )
        procs.append(p)
        ports.append(port)
        print(f"  FOG-A1-{i:02d} → :{port}")

    time.sleep(3.0)
    bases = [f"http://127.0.0.1:{p}" for p in ports]

    try:
        print("\nSubmitting per-node transactions...")
        for r in range(args.rounds):
            for i, port in enumerate(ports):
                t = "lightweight" if (r + i) % 3 == 0 else "standard"
                try:
                    post_json(f"http://127.0.0.1:{port}/submit", {"type": t, "cid": f"bafy-a1-{i}-{r}"})
                except Exception as e:
                    print(f"  submit :{port}: {e}")
            time.sleep(0.1)

        print("\nMesh sync rounds...")
        sys.path.insert(0, src_dir)
        from mesh_sync import sync_mesh, mesh_report

        sync_mesh(bases, rounds=args.sync_rounds)
        time.sleep(0.3)

        print("\nPost-sync status:")
        print(f"{'Node':<12} {'Port':>6} {'TXs':>6} {'Tips':>6}")
        print("-" * 36)
        counts = []
        for i, port in enumerate(ports):
            try:
                st = get_json(f"http://127.0.0.1:{port}/status")
                dag = st.get("dag") or {}
                c = dag.get("transaction_count", 0)
                counts.append(c)
                print(f"FOG-A1-{i:02d}  {port:>6} {c:>6} {dag.get('tip_count', 0):>6}")
            except Exception as e:
                print(f"FOG-A1-{i:02d}  error: {e}")
                counts.append(0)

        if counts and max(counts) > 0:
            spread = (max(counts) - min(counts)) / max(counts)
            print(f"\nTx count spread: {spread:.2%} (0% = perfect convergence)")
            print("mesh_report:", json.dumps(mesh_report(bases), indent=2))
        print("\nA1 launcher done.")
    finally:
        if not args.keep:
            print("Stopping nodes...")
            for p in procs:
                p.send_signal(signal.SIGTERM)
            for p in procs:
                try:
                    p.wait(timeout=3)
                except Exception:
                    p.kill()
        else:
            print("Nodes left running (--keep). Ports:", ports)


if __name__ == "__main__":
    main()
