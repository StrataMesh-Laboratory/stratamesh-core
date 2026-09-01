"""
CI wrapper — Track A1 process-level gossip + kill/recovery.

Calls testnet_launcher.py against ≥3 real OS processes on one host.
Not an in-process sim (see multi_node_sim.py / protocol_benchmark.py for that).
Not multi-machine. Lab evidence only; no mainnet / aBFT claims.

Usage:
    python3 test_process_gossip.py
    python3 test_process_gossip.py --base-port 18790
"""

from __future__ import annotations

import os
import subprocess
import sys

SCRIPT = os.path.join(os.path.dirname(__file__), "testnet_launcher.py")


def main() -> None:
    extra = sys.argv[1:]
    cmd = [
        sys.executable,
        SCRIPT,
        "--nodes",
        "3",
        "--rounds",
        "3",
        "--sync-rounds",
        "8",
        "--post-kill-rounds",
        "2",
        "--kill-node",
        "0",
        "--restart-killed",
        "--assert-spread",
        "0",
    ]
    if not any(a == "--base-port" or a.startswith("--base-port=") for a in extra):
        cmd.extend(["--base-port", os.environ.get("STRATAMESH_TEST_BASE_PORT", "18790")])
    cmd.extend(extra)
    print("test_process_gossip:", " ".join(cmd), flush=True)
    raise SystemExit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
