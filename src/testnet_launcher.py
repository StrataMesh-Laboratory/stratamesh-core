"""
StrataMesh Private Testnet Launcher — Track A1
==============================================
Starts N persistent Fog Nodes (OS processes), submits load, runs mesh gossip
sync (INV → GET /tx/{id} → POST /tx/ingest).

Usage:
    python3 testnet_launcher.py --nodes 3 --base-port 8790 --rounds 6 --sync-rounds 4
    python3 testnet_launcher.py --nodes 3 --kill-node 0 --restart-killed --assert-spread 0

Lab only: one host, N processes. Not multi-machine, not mainnet, not aBFT.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request


def post_json(url: str, data: dict, timeout: float = 5) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def get_json(url: str, timeout: float = 5) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode())


def is_up(port: int) -> bool:
    try:
        get_json(f"http://127.0.0.1:{port}/health", timeout=1.5)
        return True
    except Exception:
        return False


def wait_up(port: int, timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if is_up(port):
            return
        time.sleep(0.2)
    raise SystemExit(f"ASSERT FAIL: node on :{port} did not become healthy in {timeout}s")


def wait_down(port: int, timeout: float = 8.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not is_up(port):
            return
        time.sleep(0.15)
    raise SystemExit(f"ASSERT FAIL: killed node on :{port} still responding")


def tx_count(port: int) -> int:
    st = get_json(f"http://127.0.0.1:{port}/status")
    dag = st.get("dag") or {}
    return int(dag.get("transaction_count") or 0)


def collect_counts(ports: list[int]) -> list[int]:
    out = []
    for port in ports:
        try:
            out.append(tx_count(port))
        except Exception as e:
            print(f"  :{port} error: {e}")
            out.append(0)
    return out


def print_status(label: str, ports: list[int], counts: list[int], ids: list[int] | None = None) -> None:
    print(f"\n{label}:")
    print(f"{'Node':<12} {'Port':>6} {'TXs':>6}")
    print("-" * 28)
    for i, (port, c) in enumerate(zip(ports, counts)):
        nid = ids[i] if ids is not None else i
        print(f"FOG-A1-{nid:02d}  {port:>6} {c:>6}")


def spread_of(counts: list[int]) -> float:
    if not counts or max(counts) <= 0:
        return 1.0
    return (max(counts) - min(counts)) / max(counts)


def assert_spread(label: str, counts: list[int], max_spread: float) -> float:
    if not counts or max(counts) <= 1:
        raise SystemExit(
            f"ASSERT FAIL {label}: expected gossiped DAG txs, got counts={counts}"
        )
    s = spread_of(counts)
    if s > max_spread + 1e-12:
        raise SystemExit(
            f"ASSERT FAIL {label}: spread={s:.2%} > {max_spread:.2%} counts={counts}"
        )
    print(f"ASSERT OK {label}: spread={s:.2%} counts={counts}")
    return s


def start_node(script: str, src_dir: str, port: int, db: str, node_id: str) -> subprocess.Popen:
    return subprocess.Popen(
        [sys.executable, script, "--port", str(port), "--db", db, "--id", node_id],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=src_dir,
    )


def submit_rounds(ports: list[int], rounds: int, tag: str) -> int:
    ok = 0
    for r in range(rounds):
        for i, port in enumerate(ports):
            t = "lightweight" if (r + i) % 3 == 0 else "standard"
            try:
                post_json(
                    f"http://127.0.0.1:{port}/submit",
                    {"type": t, "cid": f"bafy-a1-{tag}-{i}-{r}"},
                )
                ok += 1
            except Exception as e:
                print(f"  submit :{port}: {e}")
        time.sleep(0.1)
    return ok


def stop_all(procs: list[subprocess.Popen | None]) -> None:
    for p in procs:
        if p is None or p.poll() is not None:
            continue
        try:
            p.send_signal(signal.SIGTERM)
        except Exception:
            pass
    for p in procs:
        if p is None:
            continue
        try:
            p.wait(timeout=3)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=int, default=3)
    parser.add_argument("--base-port", type=int, default=8790)
    parser.add_argument("--rounds", type=int, default=6)
    parser.add_argument("--sync-rounds", type=int, default=4)
    parser.add_argument("--keep", action="store_true", help="leave nodes running")
    parser.add_argument(
        "--kill-node",
        type=int,
        default=-1,
        help="after first sync, SIGTERM this process index (lab failure injection)",
    )
    parser.add_argument(
        "--restart-killed",
        action="store_true",
        help="restart killed process from the same SQLite DB and re-sync (catch-up)",
    )
    parser.add_argument(
        "--post-kill-rounds",
        type=int,
        default=2,
        help="submit rounds on remaining peers after kill (so restart has a gap)",
    )
    parser.add_argument(
        "--assert-spread",
        type=float,
        default=None,
        metavar="F",
        help="fail if (max-min)/max tx counts among live nodes exceeds F (e.g. 0)",
    )
    args = parser.parse_args()

    if args.nodes < 2:
        raise SystemExit("need --nodes >= 2 for process-level gossip")
    if args.kill_node >= args.nodes:
        raise SystemExit("--kill-node index out of range")
    if args.restart_killed and args.kill_node < 0:
        raise SystemExit("--restart-killed requires --kill-node")

    procs: list[subprocess.Popen | None] = []
    ports: list[int] = []
    dbs: list[str] = []
    script = os.path.join(os.path.dirname(__file__), "node_persistent.py")
    src_dir = os.path.dirname(__file__)
    gate = args.assert_spread is not None
    max_spread = 0.0 if args.assert_spread is None else args.assert_spread

    print(f"Launching {args.nodes} Fog Nodes (A1 private mesh, OS processes)...")
    for i in range(args.nodes):
        port = args.base_port + i
        db = f"/tmp/stratamesh-a1-{i}.db"
        if os.path.exists(db):
            os.remove(db)
        p = start_node(script, src_dir, port, db, f"FOG-A1-{i:02d}")
        procs.append(p)
        ports.append(port)
        dbs.append(db)
        print(f"  FOG-A1-{i:02d} pid={p.pid} → :{port} db={db}")

    pids = [p.pid for p in procs if p is not None]
    if len(set(pids)) != args.nodes:
        raise SystemExit(f"ASSERT FAIL: expected {args.nodes} distinct PIDs, got {pids}")

    try:
        for port in ports:
            wait_up(port)
        live = [p for p in procs if p is not None and p.poll() is None]
        if len(live) != args.nodes:
            raise SystemExit("ASSERT FAIL: a node process exited before gossip")

        print("\nSubmitting per-node transactions...")
        n_ok = submit_rounds(ports, args.rounds, tag="pre")
        if gate and n_ok < args.nodes:
            raise SystemExit(f"ASSERT FAIL: too few successful submits ({n_ok})")

        print("\nMesh sync rounds (all processes)...")
        sys.path.insert(0, src_dir)
        from mesh_sync import mesh_report, sync_mesh

        bases = [f"http://127.0.0.1:{p}" for p in ports]
        sync_mesh(bases, rounds=args.sync_rounds)
        time.sleep(0.2)

        counts = collect_counts(ports)
        print_status("Post-sync status", ports, counts)
        s0 = spread_of(counts)
        print(f"\nTx count spread: {s0:.2%} (0% = perfect convergence)")
        print("mesh_report:", json.dumps(mesh_report(bases), indent=2))
        if gate:
            assert_spread("pre-kill all-process sync", counts, max_spread)

        evidence: dict = {
            "lab": True,
            "mainnet": False,
            "abft": False,
            "multi_machine": False,
            "processes": args.nodes,
            "pids": pids,
            "pre_kill_counts": counts,
            "pre_kill_spread": s0,
        }

        if args.kill_node >= 0:
            idx = args.kill_node
            victim = procs[idx]
            print(f"\nKilling FOG-A1-{idx:02d} pid={victim.pid if victim else None} :{ports[idx]} ...")
            if victim is None or victim.poll() is not None:
                raise SystemExit("ASSERT FAIL: kill target already dead")
            victim.send_signal(signal.SIGTERM)
            try:
                victim.wait(timeout=5)
            except Exception:
                victim.kill()
                victim.wait(timeout=3)
            wait_down(ports[idx])
            procs[idx] = None
            print(f"ASSERT OK killed process unreachable on :{ports[idx]}")
            evidence["killed_index"] = idx
            evidence["killed_port"] = ports[idx]

            remain_idx = [i for i in range(args.nodes) if i != idx]
            remain_ports = [ports[i] for i in remain_idx]
            remain_bases = [f"http://127.0.0.1:{p}" for p in remain_ports]
            if len(remain_ports) < 2:
                raise SystemExit("ASSERT FAIL: need ≥2 remaining processes after kill")

            print("\nRemaining-peer submits + sync...")
            n_ok = submit_rounds(remain_ports, args.post_kill_rounds, tag="postkill")
            if gate and n_ok < len(remain_ports):
                raise SystemExit("ASSERT FAIL: remaining peers could not submit after kill")
            sync_mesh(remain_bases, rounds=args.sync_rounds)
            time.sleep(0.2)
            remain_counts = collect_counts(remain_ports)
            print_status("Remaining peers after kill", remain_ports, remain_counts, remain_idx)
            if gate:
                assert_spread("remaining-peer sync after kill", remain_counts, max_spread)
            evidence["remain_counts"] = remain_counts
            evidence["remain_spread"] = spread_of(remain_counts)

            if max(remain_counts) <= max(counts):
                raise SystemExit(
                    "ASSERT FAIL: remaining peers did not grow DAG after kill "
                    f"(pre={counts} remain={remain_counts})"
                )

            if args.restart_killed:
                print(f"\nRestarting FOG-A1-{idx:02d} from {dbs[idx]} ...")
                rp = start_node(script, src_dir, ports[idx], dbs[idx], f"FOG-A1-{idx:02d}")
                procs[idx] = rp
                wait_up(ports[idx])
                loaded = tx_count(ports[idx])
                print(f"Restarted node loaded {loaded} txs from SQLite")
                evidence["restart_loaded_txs"] = loaded
                if loaded <= 1:
                    raise SystemExit(
                        "ASSERT FAIL: restarted node did not reload persisted DAG "
                        f"(loaded={loaded})"
                    )
                if loaded >= max(remain_counts):
                    raise SystemExit(
                        "ASSERT FAIL: restarted node is not behind remaining peers; "
                        f"catch-up would be vacuous (loaded={loaded} remain={remain_counts})"
                    )
                print(
                    f"ASSERT OK restart is behind "
                    f"(loaded={loaded} < remain_max={max(remain_counts)})"
                )
                all_bases = [f"http://127.0.0.1:{p}" for p in ports]
                sync_mesh(all_bases, rounds=args.sync_rounds)
                time.sleep(0.2)
                after = collect_counts(ports)
                print_status("Post-restart catch-up", ports, after)
                if gate:
                    assert_spread("restart catch-up (all processes)", after, max_spread)
                caught = after[idx]
                if caught < max(remain_counts):
                    raise SystemExit(
                        f"ASSERT FAIL: restarted node did not catch up "
                        f"(got={caught} remain_max={max(remain_counts)} all={after})"
                    )
                evidence["post_restart_counts"] = after
                evidence["post_restart_spread"] = spread_of(after)
                print(
                    f"ASSERT OK restarted node caught up "
                    f"{loaded} → {caught} txs via INV/TX mesh_sync"
                )

        print("\nevidence:", json.dumps(evidence, indent=2))
        print("\nA1 launcher done. (lab processes only; not multi-host, not mainnet)")
    finally:
        if not args.keep:
            print("Stopping nodes...")
            stop_all(procs)
        else:
            print("Nodes left running (--keep). Ports:", ports)


if __name__ == "__main__":
    main()
