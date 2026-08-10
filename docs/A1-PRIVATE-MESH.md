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

## Config
`config/peers.a1.example.json` — list peer URLs for operators.

## Exit criteria (roadmap)
≥3 hosts, shared tip set growth, INV/TX sync sustained. Lab demo: 3 local processes, **0% tx-count spread** after sync.
