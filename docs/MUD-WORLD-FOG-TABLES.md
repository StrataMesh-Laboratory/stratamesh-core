# MUD world × Fog tables

Lattice-MUD **shape**, Fog **store**. Not an EVM world. `oracle_live=false`.

Canonical schema: [`contracts/mud/tables.json`](../contracts/mud/tables.json).

## Tables

| Table | Key | Fog source | Notes |
|-------|-----|------------|--------|
| **Object** | `object_id` | `src/nft.py` ObjectRegistry | NFT identity. CID-only rows may exist with empty `object_id` in `src/cid_store.py`. |
| **Parcel** | `object_id` | tokenize catalog `kind=parcel` `unmovable: true` | Trade **title**, not the dirt. Bundle owner is Fog wallet / operator email. |
| **Subject** | `subject_id` | account / SCA / ACB | Painel + Bancada. **Not** objects. Fog node is infrastructure — no Subject row. |

## Fog pulse honesty

`/status` SPA registry + DAG `transaction_count` stay non-null (`source=registry|empty`). n=2 is mesh provision, **not** a second host.

## Illegal

- NFT without CID
- STRATA ERC-20 faucet
- SCA/ACB as `Object` rows
- workers.dev as the world store
- Claiming M-II from same-Mac EDGE or MariaDB

## Prove later (distinct host)

Peer `NODE_ID` ≠ `FOG-NODE-PT-CM-001`, own DB, Tailscale — [`docs/FOG-PEER-PROVE.md`](./FOG-PEER-PROVE.md). Until then these tables are **lab local**.
