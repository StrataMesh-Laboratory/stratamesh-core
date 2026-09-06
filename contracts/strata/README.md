# STRATA OpenZeppelin scaffolds (lab)

PoC **only**. `oracle_live=false`. Absorb OZ ERC-20 / 721 / 1155 **mechanics** — do not import ETH ontology into Fog subjects/objects.

## Ontology (normative)

See `docs/SUBJECT-OBJECT-ECONOMY.md`, `docs/STRATA_NFT_ONTOLOGY.md`, `docs/MUD-WORLD-FOG-TABLES.md`.

| Thing | Is | Is not |
|-------|----|--------|
| Subject (User / SCA / ACB) | Actor | Token, lot, Fog node |
| `object_id` (STRATA NFT) | The object | CID, fungible STRATA, lot |
| Aspectos | Child objects | Contracts |
| Contrato | Title or optional rules/SPA block | Aspecto; “the whole NFT” |
| Parcel | Unmovable land `object_id` | Something you put in inventory |
| Lot | Catalog fungible trade row | NFT / `object_id` |
| Fungible STRATA | Subject dashboard Balance | Catalog NFT |

## Files

| File | May represent |
|------|----------------|
| `StrataPoc20.sol` / `StrataERC20.sol` | Fungible L-STRATA PoC minter |
| `Object721.sol` / `StrataObjectNFT.sol` | `object_id` (dirt immovable ≠ title freeze) |
| `Object1155.sol` / `StrataCatalog1155.sol` | **Lots** / editions |
| `../openzeppelin/ObjectRegistry.sol` | object_id → cid registry |

Prefer **one** family per deploy experiment; dual files exist from parallel PASS ships — do not treat both as live mainnet.

## Locks

- No public faucet. No secrets in git.
- Never mint Subjects. Never encode SCA as ERC-721.
- Never put `kind=lot` on the Object table.
