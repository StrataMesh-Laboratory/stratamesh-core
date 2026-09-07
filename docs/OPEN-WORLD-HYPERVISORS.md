# Open World Hypervisors — Macro vs Micro (normative)

**Status:** Normative for the Open World itself (2026-09-07)  
**Scope:** Mundo Aberto / Virtual Realm hosting — **not** Fog appliance docs  
**Related:** [`HOLONIC-LAYERS.md`](./HOLONIC-LAYERS.md) · [`LUSITANIA-NOMENCLATURE.md`](./LUSITANIA-NOMENCLATURE.md) · [`LUSITANIA-PLAYER-REPORT.md`](./LUSITANIA-PLAYER-REPORT.md) · [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md) · `frontend/lab-land.json` · `contracts/cmn/realms.json`

## Thesis

A **Virtual Realm** (*Domínio Virtual*) is the hypervisor plane that hosts **Open Worlds** (*Mundos Abertos*). Inside that plane we distinguish:

| Term | Meaning |
|------|---------|
| **Macrohypervisor** | Virtual Realm capacity that hosts **one** Open World (or that realm’s world-server plane) — sovereignty / capacity envelope for that *Mundo Aberto*. |
| **Microhypervisor** | Mirrored / shard host instances that run **parcels or zones of the same** Open World land-bundle. Same bundle identity whether parcels sit on a **shared LAB server** or on **mirrored micros**. |

```
Virtual Realm (Domínio Virtual)
  └ Macrohypervisor ──────── hosts ONE Open World identity
        ├ shared LAB server  (all parcels co-located)
        └ Microhypervisors   (mirrored/shard hosts; same land-bundle id)
              └ parcels / zones (unmovable dirt aspectos)
```

Technical meaning stays: capacity, isolation, mirroring. Lore/social nomenclature **bridges onto** that host scale (below) — it does not rename Fog nodes.

## Land bundle

- **Land bundle** = STRATA object (`kind=bundle`, e.g. `obj-lab-land-bundle` / “CMN Open World #1”) whose **aspectos** are **parcels**.
- Parcels are **unmovable** world dirt (`unmovable=true`). You trade **title** (`ownership_title` / contrato), never pick up dirt into inventory.
- See [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md) §Parcel · [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) parcel caveat · `frontend/lab-land.json`.

Lab note: CMN Open World #1 land bundle = parcels on **shared LAB server** *or* mirrored **microhypervisors** — one bundle identity either way.

## Two Open Worlds (realms)

| Realm | Class | Hosts sandboxes? | Role |
|-------|-------|------------------|------|
| `cmn-main-sandbox-host` | main | yes | CMN Main Open World — Bancada / sandbox host |
| `lore-olissippo-lusitanian` | lore | **no** (`not_main`) | Lusitania lore Open World (Olissippo door) — same Subject/Object mechanics; **not** main |

Registry: `contracts/cmn/realms.json`. Lusitania must never be treated as `cmn-main`.

## Bridge: social nomenclature ↔ world host scale

Normative social map ([`LUSITANIA-NOMENCLATURE.md`](./LUSITANIA-NOMENCLATURE.md)):

| Social | Gloss | World-host bridge |
|--------|-------|-------------------|
| **gens** | Playable house | Player line on **holdings / title** on parcels within the Open World |
| **populus** | Tribe’s gentes | Tribal-scale presence across **zones / parcels** of that world |
| **Lusitani** confederation | All Lusitanian-culture populi | The **Lusitania Open World / confederation layer** hosted on that world’s **macrohypervisor** (+ its **microhypervisors**) |

CMN Main Open World asks *what can you create?* (Bancada).  
Lusitania Open World asks *what survives you?* (gens continuity) — same STRATA seriousness, different realm class.

## Host stamps (contracts)

Optional light stamps (do not invent Fog topology here):

- `macrohypervisor_id` — world-server plane / capacity id for that Open World  
- `microhypervisor_ids` — mirrored/shard host ids serving the same land-bundle  

Applied lightly on lore world / realm index where present (`contracts/mud/olissippo-world.json`, `contracts/cmn/realms.json`).

## Anti-rules

- Do **not** conflate microhypervisors with Fog appliance nodes (`FOG-*` docs are out of scope for this doctrine).
- Do **not** merge Lusitania lore realm into CMN main sandbox-host.
- Do **not** make parcels inventory-movable by bundling them.
