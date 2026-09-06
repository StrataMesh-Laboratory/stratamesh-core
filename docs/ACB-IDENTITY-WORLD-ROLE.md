# ACB identity vs world role · lore vs CMN main

**Parents:** [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) · [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md) · [`LORE-VILLAGE-ACB-MUD.md`](./LORE-VILLAGE-ACB-MUD.md)

## Two registries (do not conflate)

| Concern | Registry | Key | Answers |
|--------|----------|-----|---------|
| **Identity** | **StrataMesh** | `subject_id` (`kind`: user\|sca\|acb) | *Who* the Subject is |
| **World role** | **CMN** | `world_role_id` → `subject_id` + `realm` + `role` | *What* they do in a world |

- Identity files: `contracts/stratamesh/subject-identity-*.json`
- World roles: `contracts/cmn/world-role-*.json`
- An ACB may hold **one** StrataMesh identity and **many** CMN world roles across realms.
- **ACB ≠ NFT** in both registries. Roles never mint `object_id` for the Subject.

Legacy lore-coupled ids (`acb-oli-*`) are **aliases** resolved to StrataMesh `subject_id` (e.g. `acb-boutius-001`).

## CMN realms: main vs lore

| Realm | Class | Hosts sandboxes? | Mechanics |
|-------|-------|------------------|-----------|
| `cmn-main-sandbox-host` | **main** | **Yes** — Bancada / open-world sandboxes | Canonical |
| `lore-olissippo-lusitanian` | **lore** | **No** | **Same** Subject/Object, roles, validate/execute |

Olissippo is a **separate lore world** inside CMN’s realm list — **not** the main world where sandboxes are hosted — yet it uses the **same mechanics**. Never promote lore to main; never point sandbox hosting at Olissippo.

Index: [`contracts/cmn/realms.json`](../contracts/cmn/realms.json)

## UI

Chrome may say “pessoa” / “papel na aldeia”. Do not expose `subject_id` / `world_role_id` / `object_id` as product jargon.
