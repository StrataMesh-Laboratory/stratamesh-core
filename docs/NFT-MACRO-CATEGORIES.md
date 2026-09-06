# NFT macro-categories (UX + ontology bridge)

**Status:** Normative for create-wizard UX and for what STRATA NFT *may* represent.  
**Parents (do not contradict):**

- [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) — subjects act; objects are acted upon
- [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) — equation · C · ownership fractions · P_market · Bundle/aspects · SPA/APS
- [`DIGITAL-OBJECTS.md`](./DIGITAL-OBJECTS.md) — CID ≠ `object_id` ≠ fungible STRATA
- [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md) · [`contracts/mud/tables.json`](../contracts/mud/tables.json)
- [`UI-LOCALE-CPLP.md`](./UI-LOCALE-CPLP.md) — product UI locale

---

## 1. Templates are entry points, not a ceiling

Product UI (PT-PT / EN-GB mirror): **broad category → name → optional place → optional details**.  
Templates do **not** exhaust what a STRATA NFT can be. **Outro** keeps the set open.

| Template (PT UI) | EN-GB mirror (sense) | Under the hood |
|------------------|----------------------|----------------|
| Objecto / Mobiliário / Sala / Terreno | Object / Furniture / Room / Land | `Object.kind` ∈ {object, room, parcel} |
| Contrato de execução | Execution agreement | Object + `Contract.kind=spa_aps` (static→dynamic→terminated) |
| Escritura · virtual / financeira / física | Ownership deed · virtual / financial / physical | Object + `Contract.kind=ownership_title` + custodianship fields |
| Lote de troca | Trade lot | **`Lot`** — not an Object / not an NFT |
| Outro | Other | `template=other`; personalise later |

**Schema lock:** macro templates never invent a new `Object.kind`. Deeds and execution contracts are still **`kind=object`** (or room/parcel when that is what they title). Lots stay off the Object table.

---

## 2. Two contract roles (same Contract table)

| Role | `Contract.kind` | What it binds | Relation to C / P_market |
|------|-----------------|---------------|---------------------------|
| **Execution** | `spa_aps` | The NFT’s own run (SPA/APS) | **static** reserves C (floor); **dynamic** burns above floor; fractions still sell at **P_market ≠ fraction·C**; redeem when P_market < C stays distinct |
| **Ownership deed / title** | `ownership_title` | Title instrument held by a **Subject** | Optional C on the deed-object; Agora sells **ownership fractions** of that deed-NFT at P_market — not the underlying cold asset itself |

### Deed subtypes (`asset_class`)

- **virtual** — digital / in-world / protocol-native underlying
- **financial** — financial instrument / claim
- **physical** — tangible good

Tokenisation path: underlying ownership is transferred **legally** into the StrataMesh **user account** (Subject) via an **international legal custodianship** agreement.

### Cold storage binds validity

When the underlying sits in **cold storage**, that custodianship **binds whether the token remains valid**.  
This is a **legal / institutional** binding onto the Subject’s deed-object — **not** Fog infrastructure, not a Subject, not fungible Balance, and **not** a substitute for C.

Parcel/land titles already use `ownership_title` over **unmovable** world dirt ([`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md) §Parcel). Deeds **generalise** that title instrument to virtual / financial / physical underlyings under custodianship — they do not replace the parcel anti-rule (never pick up dirt).

---

## 3. How this sits in the equation

```
STRATA NFT = NonFungibleObject
  + FractionalEconomicOwnership
  + Collateral
  + (Optional) StateMachine
  + Actions
  + (Optional) Bundle
```

- **Execution template** emphasises StateMachine + Actions + C burn path (SPA/APS).
- **Deed template** emphasises FractionalEconomicOwnership + `ownership_title` + custodianship; StateMachine optional.
- **Bundle / aspects** still apply: a deed or execution NFT may contain child NFTs as aspects (tree, no cycles; parent C/ownership does not silently absorb children) — see [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) §Bundle.

Agent owns/operates NFT — never reverse ([`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md)).

---

## 4. Digital-object layers (unchanged)

Deed and execution NFTs still use the four layers in [`DIGITAL-OBJECTS.md`](./DIGITAL-OBJECTS.md):

| Layer | Deed / execution |
|-------|------------------|
| CID | Content of the deed/contract bytes (if composed) |
| DAG | History vertex |
| `object_id` | Network identity of the STRATA NFT |
| STRATA (C) | Interior collateral — lab `0` until `oracle_live`; legal custodianship ≠ economic mint |

GNU Atelier remains an **optional renderer**. A deed with `renderer=none` is still a valid object.

---

## 5. UX honesty

- No `object_id` / aspects / contracts jargon in the create wizard ([product rule](./UI-LOCALE-CPLP.md)).
- PT UI words: *escritura*, *contrato de execução*, *custódia*, *cofre / cold storage* as plain language — not lawyer/dev chrome.
- Code & eng docs: international English (`deed`, `custody`, `cold_storage_binds_validity`, `spa_aps`, `ownership_title`).

---

## 6. Institutions layer

International legal custodianship lives under **Institutions** in the subject–object stack (alongside Agora, SPAs, governance) — not under Objects or Infrastructure. The **deed NFT** is the Object; the **custodianship agreement** is the institutional binding that can gate token validity when cold storage applies.
