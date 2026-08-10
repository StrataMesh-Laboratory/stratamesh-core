# Phase 1 Scaffold — Core DAG + IPFS Linkage

**Status:** Scaffolding in progress (Orchestrator)  
**Target exit:** Multi-node testnet with persistent DAG, CID embedding, and basic parent resolution.

## Components under construction

### 1. Persistent DAG (`src/persistent_dag.py`)
- SQLite-backed drop-in replacement for the in-memory DAG
- Survives restarts
- Same tip-selection and attach interface

### 2. CID Verification Hook
- Every transaction may carry an IPFS CID
- Future: verify CID resolves / pin on Fog nodes under SPA

### 3. Parent Resolution
- Current multi-node sim assumes parents are already known
- Next: explicit `get_tx` / `get_parents` gossip messages so nodes can request missing history

### 4. Formal Properties (tip selection)
Documented targets for later verification:
- Liveness: honest tips are eventually selected with non-zero probability
- Safety against lazy/parasite tips (weight bias)
- Preferential treatment of LIGHTWEIGHT transactions without starving STANDARD ones

### 5. Testnet goals
- ≥ 3 independent processes (or containers) exchanging transactions
- Persistent state per node
- Public status endpoint reflecting real tip/tx counts
- Simple CLI for submitting transactions and querying confidence

## Immediate Orchestrator tasks
- [x] PersistentDAG skeleton
- [ ] Integrate PersistentDAG into local_dag_node
- [ ] Add missing-parent request path to gossip
- [ ] Minimal CID pin stub (log-only for now)
- [ ] Property-based tests for tip selection
- [ ] Docker / process launcher for 3-node private testnet
