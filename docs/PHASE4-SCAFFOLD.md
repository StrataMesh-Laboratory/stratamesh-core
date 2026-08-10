# Phase 4 Scaffold — Application Primitives

**Status:** Lab scaffold (2026-08-10)

## NFT / CID objects
- `src/nft.py` — registry of CID-backed assets
- `POST /nft/mint` `{ "cid", "title" }` → on-graph tx + optional pin
- `POST /nft/transfer` `{ "asset_id", "to" }`
- `GET /nft`

## Agora settlement (Phase 3+)
- Fills require **seller STRATA balance ≥ qty**
- On match: `token.transfer(seller → buyer, qty)`
- Underfunded sell orders are deactivated
- Lab note: no separate quote currency yet (STRATA-for-STRATA)

## API surface (node)
```
GET  /nft /token /agora
POST /nft/mint /nft/transfer /token/mint /agora/order
```
