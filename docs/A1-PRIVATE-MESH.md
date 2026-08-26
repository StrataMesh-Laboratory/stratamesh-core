# Track A1 — Private multi-node mesh

## Run
```bash
cd src
python3 testnet_launcher.py --nodes 3 --base-port 8790 --rounds 4 --sync-rounds 3
```

## Sync model
1. `GET /inv` — inventory
2. `GET /tx/{id}` — full tx
3. `POST /tx/ingest` — accept remote tx
4. `mesh_sync.sync_mesh(bases)` — pairwise pull/push until inventories converge

## Kill one process + restart catch-up (CI)

One GitHub Actions runner, **three OS processes** (not multi-machine):

```bash
cd src
python3 test_process_gossip.py
# equivalent:
python3 testnet_launcher.py --nodes 3 --base-port 8790 --rounds 3 --sync-rounds 4 \
  --kill-node 0 --restart-killed --post-kill-rounds 2 --assert-spread 0
```

What the gate asserts (lab only):

1. ≥3 distinct PIDs stay up and exchange txs until **0% tx-count spread**.
2. **SIGTERM one process** → that port is unreachable.
3. Remaining ≥2 processes keep submitting and reconverge (`--assert-spread 0`).
4. Killed process is **restarted from the same SQLite DB**, is behind remaining peers, then **catches up** via INV/TX `mesh_sync`.

Workflow: `.github/workflows/process-gossip.yml` (push/PR/`workflow_dispatch`; no Worker probes, no extra crons).

This is **not** multi-host (≥2 machines), **not** mainnet, **not** aBFT.

## Config
`config/peers.a1.example.json` — list peer URLs for operators.

## Exit criteria (roadmap)
≥3 hosts, shared tip set growth, INV/TX sync sustained. Lab demo: 3 local processes, **0% tx-count spread** after sync. CI currently gates the **local-process + kill/restart** slice; true multi-machine remains open.
