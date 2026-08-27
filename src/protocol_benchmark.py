#!/usr/bin/env python3
"""
StrataMesh Protocol Benchmark Harness
=====================================
Aligned with docs/WIRE-PROTOCOL-v1.md and docs/THREAT-MODEL-v1.md.

Measures multi-node DAG gossip behaviour and lab invariants.
Does NOT claim production finality, aBFT, or Sybil resistance.

Usage:
    python3 protocol_benchmark.py
    python3 protocol_benchmark.py --nodes 10 --rounds 40 --loss 0.3
    python3 protocol_benchmark.py --json

Exit 0 if all hard gates pass; 1 otherwise.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Set, Tuple

from tip_selection import DAG, Transaction, TxType
from finality import tip_confidence, deep_confidence

# ---------------------------------------------------------------------------
# Minimal economic poles (WIRE §8) — in-process only
# ---------------------------------------------------------------------------

MINT = "#mint"
BURN = "#0"
NODE_WALLET = "FOG-NODE-PT-CM-001"


@dataclass
class LabLedger:
    """Enforces I1–I6 in miniature for harness gates."""

    balances: Dict[str, float] = field(default_factory=dict)
    issued: float = 0.0
    burned: float = 0.0
    lab_only: Dict[str, float] = field(default_factory=dict)

    def mint_poc(self, to: str, amount: float) -> bool:
        if amount <= 0:
            return False
        # I2: mint only via this path in the harness
        self.balances[to] = self.balances.get(to, 0.0) + amount
        self.issued += amount
        return True

    def mint_lab_bootstrap(self, to: str, amount: float) -> bool:
        if amount <= 0:
            return False
        self.lab_only[to] = self.lab_only.get(to, 0.0) + amount
        # lab_only does not increase transit issued
        return True

    def transfer(self, frm: str, to: str, amount: float) -> bool:
        # I1: #mint never receives ordinary transfers
        # I3: #0 never initiates transfers
        if frm in (MINT, BURN) or to == MINT:
            return False
        if amount <= 0 or self.balances.get(frm, 0.0) < amount:
            return False
        self.balances[frm] -= amount
        self.balances[to] = self.balances.get(to, 0.0) + amount
        return True

    def burn(self, frm: str, amount: float) -> bool:
        if frm == BURN:
            return False
        if amount <= 0 or self.balances.get(frm, 0.0) < amount:
            return False
        self.balances[frm] -= amount
        self.burned += amount
        self.balances[BURN] = self.balances.get(BURN, 0.0) + amount
        # I3: #0 cannot transfer out — no spend path from BURN
        return True

    def try_spend_burn_sink(self, to: str, amount: float) -> bool:
        """Must always fail (I3)."""
        return self.transfer(BURN, to, amount)

    def try_pay_mint(self, frm: str, amount: float) -> bool:
        """Must always fail (I1)."""
        return self.transfer(frm, MINT, amount)

    def circulating(self) -> float:
        return sum(v for k, v in self.balances.items() if k not in (MINT, BURN))

    def invariant_i6(self) -> bool:
        # sum(spendable) == issued - burned
        return abs(self.circulating() - (self.issued - self.burned)) < 1e-9


# ---------------------------------------------------------------------------
# Simulated mesh node with parent-gap + loss
# ---------------------------------------------------------------------------


@dataclass
class MeshNode:
    node_id: str
    dag: DAG = field(default_factory=DAG)
    pending: Dict[str, Transaction] = field(default_factory=dict)
    received: int = 0
    rejected_replay: int = 0
    rejected_parent: int = 0
    gossip_out: int = 0
    loss_rate: float = 0.0

    def __post_init__(self):
        if not self.dag.txs:
            self.dag.bootstrap()

    def submit(self, tx_type: str = "standard", cid: Optional[str] = None, seed: str = "") -> Optional[Transaction]:
        parents = self.dag.select_tips(k=2)
        if not parents:
            parents = [self.dag.genesis_id or "genesis"]
        t = TxType.LIGHTWEIGHT if tx_type == "lightweight" else TxType.STANDARD
        seq = len(self.dag.txs)
        tx = Transaction(
            tx_id=Transaction.make_id(self.node_id, str(seq), seed or f"seq-{seq}"),
            tx_type=t,
            parents=parents,
            weight=1.0,
            cid=cid,
            sender=self.node_id,
        )
        if self.dag.attach(tx):
            return tx
        return None

    def receive(self, tx: Transaction) -> str:
        """Returns accepted | replay | pending_parents | lost | reject."""
        if random.random() < self.loss_rate:
            return "lost"
        if tx.tx_id in self.dag.txs:
            self.rejected_replay += 1
            return "replay"
        missing = [p for p in tx.parents if p not in self.dag.txs]
        if missing:
            self.pending[tx.tx_id] = tx
            self.rejected_parent += 1
            return "pending_parents"
        if self.dag.attach(tx):
            self.received += 1
            self._flush_pending()
            return "accepted"
        return "reject"

    def _flush_pending(self) -> None:
        progress = True
        while progress:
            progress = False
            for tid in list(self.pending.keys()):
                tx = self.pending[tid]
                if all(p in self.dag.txs for p in tx.parents):
                    if tid not in self.dag.txs and self.dag.attach(tx):
                        self.received += 1
                        progress = True
                    self.pending.pop(tid, None)

    def deliver_missing_parents(self, source: "MeshNode") -> int:
        """Pull missing parents from a peer (GETDATA analogue)."""
        delivered = 0
        for tid, tx in list(self.pending.items()):
            for p in tx.parents:
                if p not in self.dag.txs and p in source.dag.txs:
                    parent = source.dag.txs[p]
                    # deliver parent first (may itself need parents — shallow lab)
                    if all(pp in self.dag.txs for pp in parent.parents) or not parent.parents:
                        if parent.tx_id not in self.dag.txs:
                            self.dag.attach(parent)
                            delivered += 1
            self._flush_pending()
        return delivered

    def ingest_with_ancestors(self, source: "MeshNode", tx_id: str, stack: Optional[Set[str]] = None) -> int:
        """Inventory/GETDATA: attach tx and ancestors from peer, parent-first."""
        if stack is None:
            stack = set()
        if tx_id in self.dag.txs or tx_id in stack:
            return 0
        if tx_id not in source.dag.txs:
            return 0
        stack.add(tx_id)
        tx = source.dag.txs[tx_id]
        n = 0
        for p in tx.parents:
            n += self.ingest_with_ancestors(source, p, stack)
        if tx_id not in self.dag.txs:
            if self.dag.attach(tx):
                n += 1
        stack.discard(tx_id)
        return n

    def sync_from(self, source: "MeshNode") -> int:
        """Full honest inventory sync from one peer (lab analogue of INV+GETDATA)."""
        delivered = 0
        for tid in sorted(source.dag.txs.keys()):
            delivered += self.ingest_with_ancestors(source, tid)
        self._flush_pending()
        return delivered


def gossip_round(nodes: List[MeshNode], fanout: int = 1) -> int:
    msgs = 0
    for n in nodes:
        peers = [p for p in nodes if p is not n]
        if not peers or len(n.dag.txs) < 2:
            continue
        candidates = [t for t in n.dag.txs.values() if t.tx_id != "genesis"]
        if not candidates:
            continue
        for _ in range(fanout):
            tx = random.choice(candidates)
            peer = random.choice(peers)
            peer.receive(tx)
            # opportunistic parent fill
            peer.deliver_missing_parents(n)
            n.gossip_out += 1
            msgs += 1
    return msgs


def mesh_tx_ids(nodes: List[MeshNode]) -> Set[str]:
    ids: Set[str] = set()
    for n in nodes:
        ids.update(n.dag.txs.keys())
    return ids


def convergence_ratio(nodes: List[MeshNode]) -> float:
    counts = [len(n.dag.txs) for n in nodes]
    if not counts or max(counts) == 0:
        return 0.0
    return min(counts) / max(counts)


def tip_jaccard(a: MeshNode, b: MeshNode) -> float:
    ta, tb = a.dag.tips, b.dag.tips
    if not ta and not tb:
        return 1.0
    inter = len(ta & tb)
    union = len(ta | tb) or 1
    return inter / union


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------


@dataclass
class ScenarioResult:
    name: str
    passed: bool
    metrics: dict
    notes: str = ""


def scenario_honest_mesh(nodes_n: int, rounds: int, seed: int) -> ScenarioResult:
    random.seed(seed)
    nodes = [MeshNode(f"FOG-SIM-{i:02d}") for i in range(nodes_n)]
    t0 = time.perf_counter()
    submitted = 0
    msgs = 0
    early_ids: List[str] = []
    for r in range(rounds):
        for n in nodes:
            if random.random() < 0.75:
                tx = n.submit(
                    tx_type="lightweight" if random.random() < 0.3 else "standard",
                    cid=f"bafy-{n.node_id}-{r}" if random.random() < 0.15 else None,
                    seed=f"{r}-{n.node_id}",
                )
                if tx:
                    submitted += 1
                    if len(early_ids) < 8:
                        early_ids.append(tx.tx_id)
        msgs += gossip_round(nodes, fanout=2)
        msgs += gossip_round(nodes, fanout=1)
    # extra convergence gossip + full-mesh inventory (INV+GETDATA analogue)
    for _ in range(max(15, nodes_n * 4)):
        msgs += gossip_round(nodes, fanout=3)
        for n in nodes:
            for p in nodes:
                if p is not n:
                    n.sync_from(p)
    elapsed = time.perf_counter() - t0
    unique = mesh_tx_ids(nodes)
    conv = convergence_ratio(nodes)
    confs = []
    for n in nodes:
        for tid in early_ids:
            if tid in n.dag.txs:
                confs.append(tip_confidence(n.dag, tid))
    median_conf = sorted(confs)[len(confs) // 2] if confs else 0.0
    # Gate: high convergence in zero-loss honest mesh
    passed = conv >= 0.75 and submitted > 0 and len(unique) >= nodes_n
    return ScenarioResult(
        name="honest_mesh",
        passed=passed,
        metrics={
            "nodes": nodes_n,
            "rounds": rounds,
            "submitted": submitted,
            "unique_txs": len(unique),
            "convergence": round(conv, 4),
            "gossip_msgs": msgs,
            "median_early_confidence": round(median_conf, 4),
            "elapsed_s": round(elapsed, 4),
            "tx_per_s": round(submitted / elapsed, 2) if elapsed > 0 else 0,
            "tips_sample": list(nodes[0].dag.tips)[:5],
        },
        notes="WIRE tip+gossip path; lab confidence only",
    )


def scenario_packet_loss(nodes_n: int, rounds: int, loss: float, seed: int) -> ScenarioResult:
    random.seed(seed + 1)
    nodes = [MeshNode(f"FOG-LOSS-{i:02d}", loss_rate=loss) for i in range(nodes_n)]
    submitted = 0
    for r in range(rounds):
        for n in nodes:
            if random.random() < 0.7:
                if n.submit(seed=f"loss-{r}-{n.node_id}"):
                    submitted += 1
        gossip_round(nodes, fanout=3)
    # heal: zero loss and catch up
    for n in nodes:
        n.loss_rate = 0.0
    for _ in range(nodes_n * 8):
        gossip_round(nodes, fanout=4)
        for n in nodes:
            for p in nodes:
                if p is not n:
                    n.deliver_missing_parents(p)
    conv = convergence_ratio(nodes)
    passed = conv >= 0.65  # softer under prior loss
    return ScenarioResult(
        name="packet_loss_then_heal",
        passed=passed,
        metrics={
            "nodes": nodes_n,
            "loss_rate": loss,
            "submitted": submitted,
            "convergence_after_heal": round(conv, 4),
            "unique_txs": len(mesh_tx_ids(nodes)),
        },
        notes="THREAT T5 partial — loss then heal",
    )


def scenario_partition_heal(seed: int) -> ScenarioResult:
    random.seed(seed + 2)
    left = [MeshNode(f"L{i}") for i in range(2)]
    right = [MeshNode(f"R{i}") for i in range(2)]
    # diverge under partition
    for r in range(12):
        for n in left:
            n.submit(seed=f"L-{r}-{n.node_id}")
        for n in right:
            n.submit(seed=f"R-{r}-{n.node_id}")
        gossip_round(left, fanout=2)
        gossip_round(right, fanout=2)
    j_before = tip_jaccard(left[0], right[0])
    # heal: full mesh
    alln = left + right
    for _ in range(40):
        gossip_round(alln, fanout=4)
        for n in alln:
            for p in alln:
                if p is not n:
                    n.deliver_missing_parents(p)
    j_after = tip_jaccard(left[0], right[0])
    conv = convergence_ratio(alln)
    # Graphs should largely converge; tip sets may still differ under random tips
    passed = conv >= 0.70
    return ScenarioResult(
        name="partition_heal",
        passed=passed,
        metrics={
            "tip_jaccard_before": round(j_before, 4),
            "tip_jaccard_after": round(j_after, 4),
            "convergence_after": round(conv, 4),
            "unique_txs": len(mesh_tx_ids(alln)),
        },
        notes="THREAT T5 partition → rejoin",
    )


def scenario_replay_and_parents(seed: int) -> ScenarioResult:
    random.seed(seed + 3)
    n = MeshNode("FOG-REPLAY")
    tx = n.submit(seed="once")
    assert tx is not None
    r1 = n.receive(tx)
    r2 = n.receive(tx)
    # missing parent reject
    orphan = Transaction(
        tx_id=Transaction.make_id("orphan", "x"),
        tx_type=TxType.STANDARD,
        parents=["does-not-exist"],
        weight=1.0,
        sender="attacker",
    )
    r3 = n.receive(orphan)
    # duplicate attach via dag
    dup = n.dag.attach(tx)
    passed = r1 == "replay" and r2 == "replay" and r3 == "pending_parents" and dup is False
    return ScenarioResult(
        name="replay_and_invalid_parent",
        passed=passed,
        metrics={
            "first_replay": r1,
            "second_replay": r2,
            "orphan": r3,
            "dag_dup_attach": dup,
            "rejected_replay": n.rejected_replay,
        },
        notes="WIRE attach rules; THREAT T4",
    )


def scenario_dag_acyclic(seed: int) -> ScenarioResult:
    random.seed(seed + 4)
    d = DAG()
    d.bootstrap()
    ids = ["genesis"]
    for i in range(40):
        parents = d.select_tips(k=2 if i % 2 == 0 else 1)
        tx = Transaction(
            tx_id=Transaction.make_id("ac", str(i), str(seed)),
            tx_type=TxType.STANDARD,
            parents=parents,
            weight=1.0,
        )
        d.attach(tx)
        ids.append(tx.tx_id)
    # Detect cycle via DFS on parent edges (should be impossible if attach rules hold)
    def has_cycle() -> bool:
        visiting: Set[str] = set()
        visited: Set[str] = set()

        def dfs(u: str) -> bool:
            if u in visiting:
                return True
            if u in visited:
                return False
            visiting.add(u)
            tx = d.txs.get(u)
            if tx:
                for p in tx.parents:
                    if dfs(p):
                        return True
            visiting.remove(u)
            visited.add(u)
            return False

        return any(dfs(u) for u in d.txs)

    cyclic = has_cycle()
    # tip selection stability
    tips_ok = True
    for _ in range(20):
        sel = d.select_tips(2)
        if not all(t in d.tips for t in sel):
            tips_ok = False
    passed = (not cyclic) and tips_ok and len(d.txs) == 41
    return ScenarioResult(
        name="dag_acyclic_and_tips",
        passed=passed,
        metrics={"tx_count": len(d.txs), "tip_count": len(d.tips), "cyclic": cyclic, "tips_ok": tips_ok},
        notes="WIRE DAG remains acyclic",
    )


def scenario_economic_invariants() -> ScenarioResult:
    led = LabLedger()
    ok = True
    notes = []
    ok &= led.mint_poc(NODE_WALLET, 100.0)
    ok &= led.mint_poc("user-1", 50.0)
    ok &= led.transfer(NODE_WALLET, "user-2", 10.0)
    ok &= led.burn("user-1", 5.0)
    # I1
    if led.try_pay_mint(NODE_WALLET, 1.0):
        ok = False
        notes.append("I1 violated")
    # I3
    if led.try_spend_burn_sink("user-2", 1.0):
        ok = False
        notes.append("I3 violated")
    # I6
    if not led.invariant_i6():
        ok = False
        notes.append("I6 violated")
    # lab bootstrap does not inflate issued
    led.mint_lab_bootstrap(NODE_WALLET, 1000.0)
    if not led.invariant_i6():
        ok = False
        notes.append("lab_only affected I6")
    # replay mint is a new mint in this mini ledger — I5 is DAG-level; here we check burn irreversibility
    burned_before = led.burned
    led.burn("user-2", 1.0)
    if led.burned <= burned_before:
        ok = False
        notes.append("I4 burn not increasing")
    return ScenarioResult(
        name="economic_invariants_i1_i6",
        passed=ok and led.invariant_i6(),
        metrics={
            "issued": led.issued,
            "burned": led.burned,
            "circulating": led.circulating(),
            "lab_only_node": led.lab_only.get(NODE_WALLET, 0),
            "i6": led.invariant_i6(),
        },
        notes="; ".join(notes) if notes else "WIRE I1–I6 miniature ledger",
    )


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_all(nodes: int, rounds: int, loss: float, seed: int) -> dict:
    results: List[ScenarioResult] = [
        scenario_honest_mesh(nodes, rounds, seed),
        scenario_packet_loss(max(4, nodes // 2), max(15, rounds // 2), loss, seed),
        scenario_partition_heal(seed),
        scenario_replay_and_parents(seed),
        scenario_dag_acyclic(seed),
        scenario_economic_invariants(),
    ]
    hard = [r for r in results if r.name in (
        "replay_and_invalid_parent",
        "dag_acyclic_and_tips",
        "economic_invariants_i1_i6",
        "honest_mesh",
    )]
    soft = [r for r in results if r not in hard]
    hard_pass = all(r.passed for r in hard)
    soft_pass = all(r.passed for r in soft)
    honest = next(r for r in results if r.name == "honest_mesh")
    report = {
        "protocol": "WIRE-PROTOCOL-v1",
        "threat_model": "THREAT-MODEL-v1",
        "status": "LAB",
        "non_claims": [
            "lab confidence ≠ production finality",
            "not aBFT",
            "not Sybil-resistant",
            "single-process sim ≠ multi-host mesh",
        ],
        "benchmark": {
            "nodes": honest.metrics.get("nodes"),
            "submitted_txs": honest.metrics.get("submitted"),
            "unique_txs": honest.metrics.get("unique_txs"),
            "tx_per_s": honest.metrics.get("tx_per_s"),
            "median_confirmation_confidence": honest.metrics.get("median_early_confidence"),
            "convergence": honest.metrics.get("convergence"),
            "gossip_msgs": honest.metrics.get("gossip_msgs"),
            "elapsed_s": honest.metrics.get("elapsed_s"),
        },
        "scenarios": [
            {"name": r.name, "passed": r.passed, "metrics": r.metrics, "notes": r.notes}
            for r in results
        ],
        "gates": {
            "hard_pass": hard_pass,
            "soft_pass": soft_pass,
            "exit_ok": hard_pass,
        },
        "seed": seed,
    }
    return report


def print_human(report: dict) -> None:
    b = report["benchmark"]
    print("=" * 64)
    print("STRATAMESH PROTOCOL BENCHMARK  (LAB)")
    print("WIRE-PROTOCOL-v1 · THREAT-MODEL-v1")
    print("=" * 64)
    print(f"Nodes:                        {b['nodes']}")
    print(f"Submitted txs:                {b['submitted_txs']}")
    print(f"Unique txs (mesh):            {b['unique_txs']}")
    print(f"Throughput (submit/s):        {b['tx_per_s']}")
    print(f"Median early confidence:      {b['median_confirmation_confidence']}")
    print(f"Convergence (min/max):        {b['convergence']}")
    print(f"Gossip messages:              {b['gossip_msgs']}")
    print(f"Elapsed (s):                  {b['elapsed_s']}")
    print("-" * 64)
    print(f"{'Scenario':<32} {'Pass':<6} Notes")
    for s in report["scenarios"]:
        mark = "OK" if s["passed"] else "FAIL"
        print(f"{s['name']:<32} {mark:<6} {s['notes'][:40]}")
    print("-" * 64)
    g = report["gates"]
    print(f"Hard gates: {'PASS' if g['hard_pass'] else 'FAIL'}  Soft: {'PASS' if g['soft_pass'] else 'FAIL'}")
    print("Non-claims:")
    for c in report["non_claims"]:
        print(f"  · {c}")
    print("=" * 64)


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="StrataMesh protocol benchmark (LAB)")
    p.add_argument("--nodes", type=int, default=5)
    p.add_argument("--rounds", type=int, default=25)
    p.add_argument("--loss", type=float, default=0.3, help="packet loss rate for loss scenario")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--json", action="store_true")
    args = p.parse_args(argv)
    report = run_all(args.nodes, args.rounds, args.loss, args.seed)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_human(report)
    return 0 if report["gates"]["exit_ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
