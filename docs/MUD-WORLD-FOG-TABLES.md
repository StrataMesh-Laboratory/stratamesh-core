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
| **Aspects** | Child objects inside an object (tree) | Contracts |
| **Contract** | Ownership title **or** optional rules/SPA block | an aspect; “the whole NFT” |
| **Lot** | Catalog fungible trade-lot row | NFT / object_id / land |
| **Infrastructure** | Fog node, hops, wallets as treasury | Citizen / Subject |

```
Subject ──owns/operates──► Object (object_id)
                              │
                              ├─ optional contract block (Still/Live, floor STRATA, …)
                              ├─ aspects → child Object*
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
| `has_contract_block` | Optional; object can exist with no running contract |

**Rules:**

1. STRATA NFT **is** the object; a contract block does not exhaust it.
2. GNU Atelier is an optional **renderer**, not an object type.
3. Parcels: trade **title**, never pick up dirt into inventory / Atelier stage as a movable NFT drop.
4. Rooms: actual rooms only (e.g. Bancada) — not every parcel.
5. Bundles: objects-inside-object (aspects); no cycles; children keep their own `object_id`.

---

## Parcel (specialization of Object)

Unmovable open-world land identity. Renderer shows the **ownership contract** of that parcel (or its bundle), not a drop of the land.

| Field | Notes |
|-------|--------|
| `object_id` | Same as Object row (`kind=parcel`, `unmovable=true`) |
| `bundle_object_id` | Land-bundle object that groups parcels |
| `title_contract_id` | Tradable ownership title — held by a **Subject** |

**Anti-rule:** do not treat “bundle title holder” as non-subject infrastructure. NODE_WALLET is treasury/infrastructure; title holders are Subjects.

---

## Lot (not an Object)

Catalog representation of fungible trade lots (often L-STRATA bundles). **`lot_id` ≠ `object_id` (lot_id is NOT object_id).** UI copy: “lot (não é NFT)”.

ERC-1155 scaffolds may mirror lots; they still must not mint land or Subjects.

---

## Contract

| `kind` | Meaning |
|--------|---------|
| `ownership_title` | Tradable title over unmovable parcel/bundle |
| `spa_aps` | Specialized service NFT agreement (`static` / `dynamic` / `terminated`) |
| `other` | Future charters — still not an aspect |

**Words:** aspects / contracts are ordinary terms (not branded primitives). **Code & eng docs:** international English (`aspects`, `contracts`). **Product UI:** PT-PT is canonical (`aspectos`, `contratos`); EN-GB is the mirrored translation.

`Account` is an alias of **Subject**. `Holon` composition in older copy maps to **bundle** objects + AspectEdge — not a Subject, not a Lot.

---

## AspectEdge (bundle — all categories)

Parent → child **object_id** edges. Applies to **all** object kinds (desk→drawers, room→fixtures, land-bundle→parcels, generic object→parts).

| Rule | Detail |
|------|--------|
| Child identity | Child is its **own** STRATA NFT (`object_id`) — not a mere mesh slot |
| Aspects | Contained objects only — never contracts |
| Tree | No cycles; attach/detach via bundle primitives |
| Economy | Parent C / ownership fractions ≠ child C / fractions unless product rule links them |
| Parcels | May be aspects of a land-bundle; remain unmovable dirt |
| Example | Composite desk NFT bundles drawer NFTs as parts of the table NFT |


---

## Balance

Fungible L-STRATA on the **Subject** dashboard wallet. Mint: PdC / PoC-gated only. No faucet. Labour/hire = transfer, never mint.

---


## OwnershipFraction

Subjects own the NFT by owning **fractions of its collateralised STRATA** (not by “owning the bytes alone”).

| Field | Notes |
|-------|--------|
| `object_id` | Bound STRATA NFT |
| `subject_id` | Titular |
| `fraction` / `strata_units` | Claim weight on that NFT’s collateral |
| `collateral_share_ref` | Accounting claim on **C** — not a wallet Balance row |

**Agora:** listing sells this ownership portion at **P_market** (fungible STRATA). **P_market ≠ C × fraction.** Redeem when P_market < C is a different primitive.

## Collateral (on Object / contract tank)

| State | Collateral behaviour |
|-------|----------------------|
| `static` | **Reserve** — dormancy; floor (e.g. 0.1) reserved |
| `dynamic` | **Burn** above floor to fund the NFT’s own execution mechanisms |
| `terminated` | Residual to titulares / complete |

C lives **in** the NFT. Subject dashboard Balance is separate fungible STRATA.

## OZ / EVM scaffold mapping (lab only)

| Scaffold | May represent | Must not |
|----------|---------------|----------|
| ERC-20 (`StrataPoc20` / `StrataERC20`) | Fungible L-STRATA PoC | Public faucet; claim to be mainnet PdC |
| ERC-721 object (`Object721` / `StrataObjectNFT`) | `object_id` | Encode SCA as token; treat lot as NFT |
| ERC-721/title pattern | `ownership_title` over parcel | Transfer “dirt” as inventory |
| ERC-1155 (`Object1155` / `StrataCatalog1155`) | **Lots** / editions | Land parcels; Subjects |
| `ObjectRegistry` | object_id → cid | `mintStrata` |

**Immovable flag:** means the **world parcel identity** does not move into a backpack. Title trade is a **contract / title instrument** change of `holder_subject_id`, not `ParcelImmovable` forbidding all ownership change forever. Scaffolds that revert every ERC-721 transfer when `movable=false` must document that they model **dirt**, while **title** uses `Contract.ownership_title` (or a dedicated title token) — refine before any non-lab deploy.

---

## Locks

- Classic Three Atelier; no R3F.
- No secrets in git.
- Fog & Edge matched casing (Névoa / Limiar).
- Subjects ≠ objects ≠ infrastructure ≠ lots.
