# STRATA OpenZeppelin scaffold (lab)

PoC **only**. Absorb OZ ERC-20 / 721 / 1155 **mechanics**. Not mainnet. `oracle_live=false`.

| contract | role |
|----------|------|
| `StrataPoc20.sol` | Fungible STRATA — **minter-only**. No faucet. No public `mint`. |
| `Object721.sol` | NFT = `object_id`. Parcels cannot transfer. |
| `Object1155.sol` | Editions / lots that are **not** land and **not** STRATA value. |

Install (local, optional):

```bash
npm i @openzeppelin/contracts@5.0.2 --save-exact
```

Do not commit `node_modules`. Do not wire a faucet. Do not use workers.dev.
