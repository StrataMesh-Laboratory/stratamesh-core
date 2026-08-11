# Holonic layers — StrataMesh Web3 Metaverse (whitepaper-aligned)

Source: *Stratamesh: Next-Generation Distributed Ledger Technology* (esp. Metaverse stack).

## Correct order of abstraction (personal → global)

```
UGC Sandbox  →  Multi-User Persistent Open-Worlds  →  Virtual Realms (hypervisors)  →  Web3 Metaverse
     ↑                         ↑                              ↑
  private mint            shared persistence            fog SPA infrastructure
```

| Order | Holon | Whitepaper role |
|------:|-------|-----------------|
| **1** | **UGC Sandbox** | Personal, private crucibles; creativity minted into unique assets (NFT + IPFS) |
| **2** | **Multi-User Persistent Open-Worlds** | Shared worlds; sandbox contributions integrate as dynamic portions |
| **3** | **Virtual Realms** | **Hypervisor servers** that *instantiate and operate* open-worlds; fog nodes under voluntary DAO SPAs; each realm may carry its own meta-layer rules |
| **4** | **Web3 Metaverse** | Individual Virtual Realms coalesce into the overarching interconnected tapestry |

**Critical rule:** Open-Worlds are hosted **inside** Virtual Realms — not the reverse.

## Foundational substrate (under the Metaverse stack)

| Layer | Component | Role |
|-------|-----------|------|
| DAG core | tips, gossip, cumulative weight | Parallel txs; probabilistic finality |
| IPFS linkage | CIDs in DAG vertices | Content-addressed payloads / NFT metadata |
| Edge nodes | lightweight, user/IoT-near | Initiate txs, local cache, cheap validation |
| Fog nodes | stable, SPA-bound | Ledger share, pin/cache, contracts, optional deterministic finality, **realm hypervisors** |
| Meta-layer | app/DAO finality modules | Opt-in deterministic finality; sovereign app rules |
| Economy | PoC → STRATA → Agora; NFT mint | Contribution loop; tokenisation |
| Agency | ACBs, Proof of Subsistence, DAO Republic | Computational citizens within the Metaverse |

## Lab implementation map

| Holon | Worker | Notes |
|-------|--------|-------|
| Sandbox | `stratamesh-sandbox` | `POST /create`, `POST /publish` (+ optional NFT), `POST /integrate` → world |
| Open-World | `stratamesh-worlds` | Namespaces of experience; **must** reference a `realm_id` |
| Virtual Realm | `stratamesh-realms` | Hypervisor / SPA sovereignty; lists hosted `world_ids` |
| Metaverse | status + orchestrator aggregate | Composite view of realms + economy + ACBs |
| Substrate | `stratamesh-dag`, `stratamesh-ipfs` | CIDv1 + DAG pipeline |

## Canonical lab flow

1. **Sandbox** `create` → real IPFS CID for draft asset  
2. **Sandbox** `publish` → optional NFT mint + DAG anchor  
3. **Sandbox** `integrate` → attach published item to an **Open-World**  
4. **Open-World** is created/listed with **`realm_id`** (Virtual Realm hypervisor)  
5. **Virtual Realm** under fog SPA hosts one or more worlds  
6. Multiple realms → **Web3 Metaverse** aggregate  

## What is still lab (honest)

- No real-time multi-user 3D presence / MUOW client  
- Realm “hypervisor” is control-plane + registry, not a full VM orchestrator  
- Metaverse aggregate is API/status composition, not a single runtime  

## Document control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-08-11 | Initial (incorrect World⊃Realm ordering) |
| **2.0** | **2026-08-11** | Whitepaper-correct: Sandbox → Open-World → Virtual Realm → Metaverse |

**UNCLASSIFIED // FOG-NODE-PT-CM-001**
