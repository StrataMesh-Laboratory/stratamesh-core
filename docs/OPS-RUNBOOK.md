# Ops runbook — Calhegas Morais Fog Node (lab)

## Quick start
```bash
# terminal 1 — node
./scripts/run_fog_node.sh

# terminal 2 — public status pulse
./scripts/publish_loop.sh
```

Optional real pins:
```bash
export IPFS_API_URL=http://127.0.0.1:5001
./scripts/run_fog_node.sh
```

## One-shot health
```bash
cd src && python3 mesh_doctor.py
curl -s http://127.0.0.1:8787/status | head
curl -s https://stratamesh-status.stratamesh.workers.dev/status | head
```

## Public URLs
- Status JSON: https://stratamesh-status.stratamesh.workers.dev/status
- Live widget: https://stratamesh-status.stratamesh.workers.dev/live
- Repo: https://github.com/amcmorais/stratamesh-core

## Ingest token
Header `X-Status-Token` must match Worker binding `STATUS_TOKEN`.
Override with env `STATUS_TOKEN`.

## Phase map (lab code)
See `docs/PHASE*-SCAFFOLD.md`. Production gaps: multi-host mesh, real PQ, mainnet token, continuous host.
