# StrataMesh Core — v0.2.0-lab

**Date:** 2026-08-10  
**Node:** FOG-NODE-PT-CM-001 (Calhegas Morais)  
**Scope:** Reference implementation — **not mainnet**

## What this is
An in-process Fog node and supporting modules that exercise the whitepaper path from DAG through ACBs, with public status pulse and ops scripts.

## Included
| Area | Modules / endpoints |
|------|---------------------|
| DAG | tip selection, PersistentDAG, gossip, finality confidence |
| IPFS | stub / Kubo API / gateway client |
| SPA | on-graph register, pinner policy |
| Economy | PoC → STRATA mint, Agora + settlement, on-graph mint/trade |
| Apps | NFT/CID, UGC sandbox |
| Governance | proposals + weighted votes (2-voter quorum) |
| Agents | ACB registry + PoSbs heartbeats |
| PQ | lab key placeholders (not real crypto) |
| Ops | `run_fog_node.sh`, `publish_loop.sh`, `mesh_doctor.py` |
| Public | https://stratamesh-status.stratamesh.workers.dev/status |

## Verify
```bash
cd src && python3 mesh_doctor.py
./scripts/run_fog_node.sh
```

## Explicitly not included
- Multi-host production mesh
- Real post-quantum libraries
- Mainnet token issuance / legal compliance
- Continuous hosted Fog process (bring your own host)

## Motto
Intelligentia · Vigilantia · Veritas
