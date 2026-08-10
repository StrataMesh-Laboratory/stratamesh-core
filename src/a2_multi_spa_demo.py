#!/usr/bin/env python3
"""A2 multi-operator SPA demo across 3 local nodes."""
from __future__ import annotations
import subprocess, sys, os, time, signal, json, urllib.request

def post(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read().decode())

def get(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        return json.loads(r.read().decode())

def main():
    src = os.path.dirname(__file__)
    script = os.path.join(src, "node_persistent.py")
    procs, ports = [], [8800, 8801, 8802]
    ops = [
        ("OP-ALPHA", ["fog", "pinner"]),
        ("OP-BETA", ["edge"]),
        ("OP-GAMMA", ["fog", "edge"]),
    ]
    print("Starting 3 operator nodes...")
    for i, port in enumerate(ports):
        db = f"/tmp/stratamesh-a2-{i}.db"
        if os.path.exists(db):
            os.remove(db)
        p = subprocess.Popen(
            [sys.executable, script, "--port", str(port), "--db", db, "--id", ops[i][0]],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=src,
        )
        procs.append(p)
        print(f"  {ops[i][0]} :{port} roles={ops[i][1]}")
    time.sleep(4.5)
    try:
        for i, port in enumerate(ports):
            r = post(f"http://127.0.0.1:{port}/spa/register", {"roles": ops[i][1]})
            print("register", ops[i][0], r.get("spa_id"), r.get("pin_policy", {}).get("reason", "")[:50])
        bases = [f"http://127.0.0.1:{p}" for p in ports]
        sys.path.insert(0, src)
        from mesh_sync import sync_mesh, sync_spas, mesh_report
        sync_mesh(bases, rounds=2)
        spa_sync = sync_spas(bases)
        print("spa_sync", json.dumps(spa_sync, indent=2)[:500])
        print("\nPer-node SPA view:")
        for b in bases:
            st = get(f"{b}/spa")
            print(b, "active", st.get("active"), "by_role", st.get("by_role"), "total", st.get("total"))
        print("mesh", mesh_report(bases))
        print("A2 demo OK")
    finally:
        for p in procs:
            p.send_signal(signal.SIGTERM)
        for p in procs:
            try:
                p.wait(timeout=3)
            except Exception:
                p.kill()

if __name__ == "__main__":
    main()
