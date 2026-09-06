# MUD × Fog world tables (Account · Holon · Object · Contrato · Balance)

Lab schema notes for Lattice-MUD shaped rows on Fog. `oracle_live=false`. No USDC. No public faucet.

Companion machine schema: `contracts/mud/tables.json` (Object / Parcel / Subject).

## Account

| Field | Type | Notes |
|-------|------|-------|
| `account_id` | string | Subject key (user / SCA / ACB / operator) |
| `painel` | bool | Dashboard access |
| `bancada` | bool | Atelier / workbench access |
| `clearance` | enum | KYC / Limiar tier |

Rules: Fog **node** is infrastructure — never an Account row. SCA/ACB are subjects, not Objects.

## Holon

| Field | Type | Notes |
|-------|------|-------|
| `holon_id` | bytes16 / string | Nested part-whole identity |
| `parent_id` | optional | Bundle / tree edge |
| `kind` | enum | pulse · mesh · desk · parcel-title · … |
| `cid` | string | Optional content address |

Rules: Holons compose Objects; they do not mint fungible STRATA.

## Object

| Field | Type | Notes |
|-------|------|-------|
| `object_id` | bytes16 | NFT identity |
| `cid` | string | CID-only persist allowed without mint |
| `owner` | string | Account / Fog wallet title |
| `kind` | enum | object or lot |
| `movable` | bool | Lots / parcels **false** |

Rules: trade title, not dirt. See `contracts/mud/tables.json` Object + Parcel.

## Contrato

| Field | Type | Notes |
|-------|------|-------|
| `contrato_id` | string | SPA / APS / charter id |
| `object_id` | bytes16 | Bound NFT / holon |
| `state` | enum | static / dynamic / terminated |
| `floor_strata` | uint | Lab floor (e.g. 0.1) reserved |

Rules: compete with EVM mechanics without importing ETH ontology. PoC mint role only on-chain stubs.

## Balance

| Field | Type | Notes |
|-------|------|-------|
| `account_id` | string | Owner |
| `asset` | enum | L-STRATA or catalog units |
| `amount` | int / decimal | Lab ledger |
| `pole` | enum | #mint / #0 routing |

Rules: fungible STRATA mint stays PdC / PoC-gated. No faucet. OpenZeppelin stubs use `POC_MINTER_ROLE` only.

## Locks

- Classic Three Atelier; no R3F.
- No secrets in git.
- Fog / Edge casing: Névoa / Limiar.
