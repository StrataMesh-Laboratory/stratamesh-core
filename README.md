# StrataMesh Core

**Release:** [v0.2.0-lab](https://github.com/amcmorais/stratamesh-core/releases/tag/v0.2.0-lab) — reference Fog node (**not mainnet**)

Fog Node **Calhegas Morais** (`FOG-NODE-PT-CM-001`) · Lisbon  
Motto: *Intelligentia · Vigilantia · Veritas*

## Public pulse
- Status JSON: https://stratamesh-status.stratamesh.workers.dev/status
- Live dashboard: https://stratamesh-status.stratamesh.workers.dev/live
- Site: https://calhegasmorais.pt/

## Ops (lab)
```bash
./scripts/run_fog_node.sh
./scripts/publish_loop.sh          # separate terminal
cd src && python3 mesh_doctor.py   # full-stack self-check
```

Optional Kubo pins: `export IPFS_API_URL=http://127.0.0.1:5001`

## Stack map (lab)
| Phase | Focus |
|-------|--------|
| 0–1 | DAG, tip selection, gossip, persistent node, IPFS client |
| 2 | SPA registry, finality, status pipeline |
| 3 | PoC → STRATA, Agora + settlement |
| 4 | NFT/CID objects, UGC sandbox |
| 5 | DAO proposals & votes |
| 6 | ACB + Proof of Subsistence |
| 7 | PQ key **placeholders** (not real crypto) |

Docs: `docs/PHASE*-SCAFFOLD.md` · `docs/RELEASE-v0.2.0-lab.md` · `docs/OPS-RUNBOOK.md`

## Hybrid Orchestrator
Federated meta-learning controller (probabilistic + symbolic lobes, QIGA):
```bash
cd src && python3 -m orchestrator.meta_controller
```

## Epistemic stance
Substrate-neutral standing — function and agreement before substrate.  
See `docs/EPISTEMIC-ONTOLOGY.md`.

## Licence
MIT — see `LICENSE`
