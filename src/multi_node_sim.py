"""
StrataMesh Multi-Node Local Simulation — Phase 0
================================================
Spawns several in-process Fog Node instances that periodically
exchange tips and transactions (simple gossip). Demonstrates
parallel attachment and tip selection across nodes.

Usage:
    python3 multi_node_sim.py [--nodes 3] [--rounds 15] [--port 8787]
"""

from __future__ import annotations
import argparse
import random
import time
import threading
from typing import List, Dict
from tip_selection import DAG, Transaction, TxType
from local_dag_node import FogNode, Handler
from http.server import HTTPServer


class SimulatedNode(FogNode):
    def __init__(self, node_id: str, peers: List["SimulatedNode"] | None = None):
        super().__init__(node_id=node_id)
        self.peers = peers or []
        self.received = 0

    def gossip_once(self):
        """Push a random recent transaction (or tip) to a random peer."""
        if not self.peers or len(self.dag.txs) < 2:
            return
        with self.lock:
            candidates = [t for t in self.dag.txs.values() if t.tx_id != "genesis"]
            if not candidates:
                return
            tx = random.choice(candidates)
            # shallow copy for the peer
            peer = random.choice(self.peers)
        peer.receive(tx)

    def receive(self, tx: Transaction):
        """Accept a transaction from a peer if we don't already have it."""
        with self.lock:
            if tx.tx_id in self.dag.txs:
                return
            # Ensure parents exist (very simplified — real gossip would request missing parents)
            for p in tx.parents:
                if p not in self.dag.txs:
                    return
            ok = self.dag.attach(tx)
            if ok:
                self.tx_count += 1
                self.received += 1


def run_simulation(num_nodes: int = 3, rounds: int = 20, submit_every: int = 2):
    print(f"=== StrataMesh multi-node simulation ({num_nodes} nodes, {rounds} rounds) ===\n")
    nodes = [SimulatedNode(f"FOG-SIM-{i:02d}") for i in range(num_nodes)]
    for n in nodes:
        n.peers = [p for p in nodes if p is not n]

    for r in range(rounds):
        # Each node occasionally submits a new transaction
        for n in nodes:
            if random.random() < 0.7:
                t = "lightweight" if random.random() < 0.3 else "standard"
                n.submit(tx_type=t, cid=f"bafy-sim-{n.node_id}-{r}" if random.random() < 0.2 else None)
        # Gossip rounds
        for _ in range(submit_every):
            for n in nodes:
                n.gossip_once()
        time.sleep(0.05)

    print("Final state per node:")
    print(f"{'Node':<14} {'Local TXs':>10} {'Tips':>6} {'Received via gossip':>20}")
    print("-" * 55)
    for n in nodes:
        st = n.status()["dag"]
        print(f"{n.node_id:<14} {st['transaction_count']:>10} {st['tip_count']:>6} {n.received:>20}")

    # Rough consensus view — how many unique tx_ids across the mesh
    all_ids = set()
    for n in nodes:
        all_ids.update(n.dag.txs.keys())
    print(f"\nUnique transactions observed across mesh: {len(all_ids)}")
    print("Simulation complete.")


def run_http_seed(port: int = 8787):
    """Optionally expose the first node via HTTP for external tools."""
    node = SimulatedNode("FOG-NODE-PT-CM-001")
    # Monkey-patch the global used by the HTTP handler for demo purposes
    import local_dag_node
    local_dag_node.NODE = node
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"HTTP seed node listening on :{port}  (GET /status, POST /submit)")
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return node, server


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=int, default=3)
    parser.add_argument("--rounds", type=int, default=20)
    parser.add_argument("--port", type=int, default=0, help="If >0, also expose first node via HTTP")
    args = parser.parse_args()

    if args.port:
        seed, srv = run_http_seed(args.port)
        print("Running short gossip simulation while HTTP is live...")
        # attach the seed into a small mesh
        others = [SimulatedNode(f"FOG-SIM-{i}") for i in range(2)]
        seed.peers = others
        for o in others:
            o.peers = [seed] + [x for x in others if x is not o]
        for r in range(8):
            seed.submit(tx_type="lightweight" if r % 3 == 0 else "standard")
            for n in [seed] + others:
                n.gossip_once()
            time.sleep(0.1)
        print("Seed node status:", seed.status()["dag"])
        print("HTTP server still running — Ctrl+C to stop")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            srv.shutdown()
    else:
        run_simulation(num_nodes=args.nodes, rounds=args.rounds)
