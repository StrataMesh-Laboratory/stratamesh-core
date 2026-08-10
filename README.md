# StrataMesh Core

Open-source foundational components of **StrataMesh DLT** — a DAG + IPFS distributed ledger designed for high-throughput, fog/edge participation, and flexible application-level finality.

**Current phase:** 0 — Operational Baseline  
**Reference node:** Calhegas Morais Fog Node (`FOG-NODE-PT-CM-001`)  
**Motto:** Intelligentia · Vigilantia · Veritas

## Proof of Subsistence

Substrate-neutral resource accounting for agents (ACBs, operators, hybrids):
consume / earn / reserve → solvency → optimize · hibernate · migrate · evolve · exit.

```bash
cd src && python3 -m subsistence.runtime
```

See `docs/PROOF-OF-SUBSISTENCE.md`.

## Hybrid Orchestrator

Federated meta-learning controller with co-foundational **probabilistic** and **symbolic** lobes, integrated via a bilateral bus and evolved by a quantum-inspired genetic algorithm (QIGA).

```bash
cd src
python3 -m orchestrator.meta_controller
```

Architecture: `docs/ORCHESTRATOR-HYBRID-ARCHITECTURE.md`

## Quick start

```bash
cd src
python3 tip_selection.py          # run tip-selection self-test
python3 local_dag_node.py --port 8787
# another terminal:
curl http://localhost:8787/status
curl -X POST http://localhost:8787/submit -H 'Content-Type: application/json' -d '{"type":"lightweight"}'
```

Multi-node gossip simulation:
```bash
python3 multi_node_sim.py --nodes 4 --rounds 25
```

## Repository layout

```
stratamesh/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── docs/
│   └── ROADMAP-PUBLIC-v0.1.md
├── contracts/
│   └── SPA-FogNode-v0.1-draft.md
├── src/
│   ├── tip_selection.py          # weighted tip selection reference
│   ├── local_dag_node.py         # single-node HTTP Fog Node simulator
│   └── multi_node_sim.py         # multi-node gossip simulation
├── status/
│   ├── index.html
│   ├── status.json
│   └── STATUS-ENDPOINT-SPEC.md
└── deploy/
    ├── cloudflare-worker-status.js
    └── README-DEPLOY.md
```

## Roadmap (summary)

| Phase | Focus | Window |
|-------|-------|--------|
| 0 | Operational baseline, instrumentation, public status | Now |
| 1 | Core DAG + IPFS CID linkage, multi-node testnet | Months 1–3 |
| 2 | Fog/Edge SPAs, probabilistic finality metrics | Months 3–6 |
| 3 | Proof of Contribution, Strata token, Agora DEX | Months 5–8 |
| 4 | NFT + UGC Sandbox + first open world | Months 7–11 |
| 5 | Foundational DAO + deterministic finality modules | Months 9–13 |
| 6 | Autonomous Computational Beings | Months 12–18 |
| 7 | Post-quantum hardening (continuous) | Major milestone ~18–24 mo |

Full public roadmap: `docs/ROADMAP-PUBLIC-v0.1.md`

## Status
This repository contains the first executable artefacts of the Stratamesh core. It is intentionally minimal, readable, and ready for community review and formalisation.

## Licence
MIT — see `LICENSE`.
