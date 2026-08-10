# StrataMesh Core

**Release:** [v0.2.1-lab](https://github.com/amcmorais/stratamesh-core/releases/tag/v0.2.1-lab) — reference Fog node (**not mainnet**)

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

Docs: [`ROADMAP-PUBLIC-v0.2.md`](docs/ROADMAP-PUBLIC-v0.2.md) · `docs/PHASE*-SCAFFOLD.md` · `docs/RELEASE-v0.2.1-lab.md` · `docs/OPS-RUNBOOK.md`

## Roadmap (summary)
Lab freeze **v0.2.1-lab** exercises whitepaper pillars in-process. Production splits into:
- **Track A — Mesh reality:** always-on node → multi-host gossip → multi-operator SPAs → public testnet
- **Track B — Protocol depth:** emission policy → dual-asset Agora → meta-finality → real ACB meters → real PQ

Full detail: [docs/ROADMAP-PUBLIC-v0.2.md](docs/ROADMAP-PUBLIC-v0.2.md)

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
