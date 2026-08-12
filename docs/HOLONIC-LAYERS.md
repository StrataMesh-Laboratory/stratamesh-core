# Holonic architecture — StrataMesh DLT / Web3 Metaverse

Canonical stack (infrastructure top → inhabitance bottom), aligned with the whitepaper and node topology:

```
                    STRATAMESH DLT
                          │
      ┌───────────────────┼───────────────────┐
   NODE A              NODE B              NODE C
      │                   │                   │
   OS / VM              OS / VM              OS / VM
      │                   │                   │
      └───────────────────┼───────────────────┘
                          │
                WEB3 METAVERSE OS
                          │
           ┌──────────────┴──────────────┐
     VIRTUAL REALM A               VIRTUAL REALM B
           │                             │
    ┌──────┴──────┐                ┌─────┴─────┐
  WORLD A1      WORLD A2         WORLD B1    WORLD B2
    │             │                │           │
  Sandbox       Sandbox          Sandbox     Sandbox
    │
┌───┴────┐
User    SCA (ACB)
```

## Layer table

| Level | Layer | Role |
|------:|-------|------|
| 0 | **StrataMesh DLT** | Mesh of contributing nodes; DAG, PdC, PdS, Agora, gossip |
| 1 | **Node (OS / VM)** | Fog/edge host (e.g. FOG-NODE-PT-CM-001); physical/virtual machine |
| 2 | **Web3 Metaverse OS** | Runtime that spans nodes; schedules realms and shared services |
| 3 | **Virtual Realm** | Hypervisor-like domain: instantiates and operates worlds under realm rules / SPA |
| 4 | **World (Open-World)** | Multi-user persistent world; receives sandbox contributions as dynamic portions |
| 5 | **UGC Sandbox** | Authoring / isolation cell before (or beside) world integration |
| 6 | **User & SCA** | Humans and Seres Computacionais Autónomos inhabit sandboxes/worlds by function |

## Critical rules

1. **Open-Worlds live inside Virtual Realms** — not the reverse.
2. **Sandboxes** are the fine-grained holon where Users and SCAs act; they compose into Worlds.
3. **Node OS/VM** is substrate for the Metaverse OS — standing of SCAs remains **by function and agreement**, not by substrate.
4. **CMN lab IDs** (examples): realm `realm_1f20890b` · world `world_b787cfe9-c` · sandbox `sbx_9bed54e8-880` · node `FOG-NODE-PT-CM-001`.

## Code anchors

| Concern | Worker / store |
|---------|----------------|
| SCA environment (realm/world/sandbox/node) | `stratamesh-acb` → `acb_environment` |
| Holon labels | `ugc_sandbox` ⊂ `open_world` ⊂ `virtual_realm` under Metaverse OS on node |
| Registry publish | Orchestrator `publicar_registo` → IPFS CID |

*Updated to match operator topology diagram (2026-08).*
