# OpenZeppelin scaffold (lab)

Absorb **Ownable + AccessControl mechanics**, not an ETH mint.

- STRATA value mint stays PdC / `#mint` → `#0`. **No** `mint(address,uint256)` for STRATA.
- NFT identity is `object_id` in `src/nft.py` + MUD `Object` table.
- This folder is a compile-shaped stub. Do not deploy to mainnet. `oracle_live=false`.

## Layout

| file | role |
|------|------|
| `ObjectRegistry.sol` | Ownable registry of `object_id` → CID. No value token. |
| `../mud/tables.json` | MUD-shaped schema the registry must honor |

## Install (optional, local)

```bash
npm i @openzeppelin/contracts@5.0.2 --save-exact
```

Do not commit `node_modules`. Do not add a 6th CF cron. Do not use workers.dev as the registry.
