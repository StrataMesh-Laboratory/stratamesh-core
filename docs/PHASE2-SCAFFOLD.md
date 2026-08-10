# Phase 2 Scaffold — Nodal Hierarchy & SPAs

**Status:** Scaffold executable (2026-08-10)  
**Depends on:** Phase 0 complete, Phase 1 core runnable

## Delivered this increment

| Item | Location | State |
|------|----------|--------|
| On-graph SPA registration | `src/spa_registry.py` | Runnable — SPA txs on DAG |
| Metrics bridge | `src/metrics_bridge.py` | Status payload from DAG+SPA+PoSbs |
| Solvency gate in Orchestrator | `orchestrator/symbolic.py` | Network-wide policies require solvent proposer |
| Fog SPA template | `contracts/SPA-FogNode-v0.1-draft.md` | Draft (from Phase 0) |

## Phase 2 exit criteria (remaining)

- [ ] SPA registration visible on public status Worker (live metrics)
- [ ] Multiple real Fog/Edge operators under SPA
- [ ] Probabilistic finality confidence exported in explorer/status
- [ ] Real IPFS pin path under SPA pinning role
- [ ] On-graph opt-out / contingency execution path

## Commands

```bash
cd src
python3 spa_registry.py
python3 metrics_bridge.py
```

## Next

1. Push live metrics payload into `stratamesh-status` Worker
2. Bind SPA registry to persistent node HTTP API (`POST /spa/register`)
3. Finality confidence scores on tip set
