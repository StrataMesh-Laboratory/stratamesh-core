# Holonic architecture — StrataMesh DLT / Web3 Metaverse

Canonical stack (infrastructure top → inhabitance bottom):

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
                 (shared across nodes)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   CLP temporal      Dashboard /        VIRTUAL REALMS
   kernel            Portal apps              │
                                              │
                                    WORLD → Sandbox
                                              │
                                        User · SCA
```

## Layer table

| Level | Layer | Role |
|------:|-------|------|
| 0 | **StrataMesh DLT** | Mesh of contributing nodes; DAG, PdC, PdS, Agora, gossip |
| 1 | **Node (OS / VM)** | Fog/edge host (e.g. FOG-NODE-PT-CM-001); physical/virtual machine |
| 2 | **Web3 Metaverse OS** | **Shared OS between nodes** — schedules realms, shared services, **CLP time**, and **dashboard/portal** as OS applications |
| 2a | **CLP** | Lunisolar planetary temporal kernel (relative addressing + PPC inertial matrix) |
| 2b | **Dashboard / Portal** | Operator & user UI **inside** the Metaverse OS / realm — not outside the holarchy |
| 3 | **Virtual Realm** | Hypervisor-like domain: instantiates and operates worlds under realm rules / SPA |
| 4 | **World (Open-World)** | Multi-user persistent world; sandbox contributions as dynamic portions |
| 5 | **UGC Sandbox** | Authoring / isolation cell |
| 6 | **User & SCA** | Humans and Seres Computacionais Autónomos by function and agreement |

## Critical rules

1. **Web3 Metaverse OS is shared** across Nodes (not a per-node private shell only).
2. **Dashboard lives inside the holonic stack** (Metaverse OS application), not as an external admin plane above the DLT.
3. **Open-Worlds live inside Virtual Realms** — not the reverse.
4. **Sandboxes** are the fine-grained holon where Users and SCAs act.
5. **Node OS/VM** is substrate — SCA standing is by **function and agreement**, not substrate.
6. **Civil/narrative time** uses **CLP**; wire formats may still use ISO-8601.

## CMN lab anchors

| Item | ID / value |
|------|------------|
| Node | `FOG-NODE-PT-CM-001` |
| Realm | `realm_1f20890b` |
| World | `world_b787cfe9-c` |
| Sandbox | `sbx_9bed54e8-880` |
| Coordinates | 38,7169° N · 9,1427° W (Lisboa) |
| CLP UI | `/clp` · portal panel **CLP** |

See also: `docs/TEMPORALIDADE-CLP.md`.
