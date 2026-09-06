# MUD × Fog world tables — ontology-aligned

Lattice-MUD **shape**, Fog **store**. Not an EVM world. `oracle_live=false`.

**Normative parents (do not contradict):**

- [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) — subjects act; objects are acted upon
- [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) — STRATA NFT equation; Agent owns NFT (never reverse)
- [`DIGITAL-OBJECTS.md`](./DIGITAL-OBJECTS.md) — CID ≠ object_id ≠ fungible STRATA

Machine schema: [`contracts/mud/tables.json`](../contracts/mud/tables.json).

---

## Layer map (do not collapse)

| Layer | What | Not |
|-------|------|-----|
| **Subject** (`Subject` / Account) | User · SCA/ACB (same class) | Inventory item, Fog node, NFT |
| **Object** (`object_id`) | STRATA NFT / network object | CID, fungible STRATA, lot id |
| **Aspectos** | Child objects inside an object (tree) | Contracts |
| **Contrato** | Ownership title **or** optional rules/SPA block | Aspecto; “the whole NFT” |
| **Lot** | Catalog fungible trade-lot row | NFT / object_id / land |
| **Infrastructure** | Fog node, hops, wallets as treasury | Citizen / Subject |

```
Subject ──owns/operates──► Object (object_id)
                              │
                              ├─ optional contrato block (Still/Live, floor STRATA, …)
                              ├─ aspectos → child Object*
                              └─ if parcel: unmovable dirt; title trades separately
Subject ──Balance──► fungible L-STRATA (dashboard)
Subject ──catalog Lot──► trade-lot rows (not NFTs)
```

---

## Subject (alias: Account)

| Field | Notes |
|-------|--------|
| `subject_id` | Stable subject key |
| `kind` | `user` \| `sca` \| `acb` — SCA (PT) = ACB (EN), one class |
| `painel` / `bancada` | Dashboard vs Workbench access |

**Rules:** Fog **node** is infrastructure — never a Subject row. Desk `external_assistant` ≠ SCA. Subjects are never typed into `Object`.

---

## Object

| Field | Notes |
|-------|--------|
| `object_id` | NFT / network identity — **not** CID |
| `cid` | Content identity; CID-only persist may omit `object_id` |
| `kind` | `object` \| `room` \| `parcel` \| `bundle` — **never `lot`** |
| `unmovable` | Required `true` for parcels; rooms/bundles as product rules say |
| `has_contrato_block` | Optional; object can exist with no running contract |

**Rules:**

1. STRATA NFT **is** the object; a contrato block does not exhaust it.
2. GNU Atelier is an optional **renderer**, not an object type.
3. Parcels: trade **title**, never pick up dirt into inventory / Atelier stage as a movable NFT drop.
4. Rooms: actual rooms only (e.g. Bancada) — not every parcel.
5. Bundles: objects-inside-object (aspectos); no cycles; children keep their own `object_id`.

---

## Parcel (specialization of Object)

Unmovable open-world land identity. Renderer shows the **ownership contrato** of that parcel (or its bundle), not a drop of the land.

| Field | Notes |
|-------|--------|
| `object_id` | Same as Object row (`kind=parcel`, `unmovable=true`) |
| `bundle_object_id` | Land-bundle object that groups parcels |
| `title_contrato_id` | Tradable ownership title — held by a **Subject** |

**Anti-rule:** do not treat “bundle title holder” as non-subject infrastructure. NODE_WALLET is treasury/infrastructure; title holders are Subjects.

---

## Lot (not an Object)

Catalog representation of fungible trade lots (often L-STRATA bundles). **`lot_id` ≠ `object_id` (lot_id is NOT object_id).** UI copy: “lot (não é NFT)”.

ERC-1155 scaffolds may mirror lots; they still must not mint land or Subjects.

---

## Contrato

| `kind` | Meaning |
|--------|---------|
| `ownership_title` | Tradable title over unmovable parcel/bundle |
| `spa_aps` | Specialized service NFT agreement (`static` / `dynamic` / `terminated`) |
| `other` | Future charters — still not “aspecto” |

**Naming lock:** **Aspectos** = contained objects. **Contrato** = rules/title/SPA. Never call a contrato an aspecto. Never swap those words.

`Account` is an alias of **Subject**. `Holon` composition in older copy maps to **bundle** objects + AspectoEdge — not a Subject, not a Lot.

---

## AspectoEdge

Parent → child object edges only. Child remains a full Object (own tank/Still/Live if present).

---

## Balance

Fungible L-STRATA on the **Subject** dashboard wallet. Mint: PdC / PoC-gated only. No faucet. Labour/hire = transfer, never mint.

---

## OZ / EVM scaffold mapping (lab only)

| Scaffold | May represent | Must not |
|----------|---------------|----------|
| ERC-20 (`StrataPoc20` / `StrataERC20`) | Fungible L-STRATA PoC | Public faucet; claim to be mainnet PdC |
| ERC-721 object (`Object721` / `StrataObjectNFT`) | `object_id` | Encode SCA as token; treat lot as NFT |
| ERC-721/title pattern | `ownership_title` over parcel | Transfer “dirt” as inventory |
| ERC-1155 (`Object1155` / `StrataCatalog1155`) | **Lots** / editions | Land parcels; Subjects |
| `ObjectRegistry` | object_id → cid | `mintStrata` |

**Immovable flag:** means the **world parcel identity** does not move into a backpack. Title trade is a **contrato / title instrument** change of `holder_subject_id`, not `ParcelImmovable` forbidding all ownership change forever. Scaffolds that revert every ERC-721 transfer when `movable=false` must document that they model **dirt**, while **title** uses `Contrato.ownership_title` (or a dedicated title token) — refine before any non-lab deploy.

---

## Locks

- Classic Three Atelier; no R3F.
- No secrets in git.
- Fog & Edge matched casing (Névoa / Limiar).
- Subjects ≠ objects ≠ infrastructure ≠ lots.
