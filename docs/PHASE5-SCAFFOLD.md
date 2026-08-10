# Phase 5 Scaffold — Governance & UGC

## Governance
- `POST /gov/propose` `{title, body}` → on-graph
- `POST /gov/vote` `{proposal_id, choice: yes|no, weight}`
- `GET /gov`
- Lab quorum: ≥2 voters before auto pass/reject

## UGC Sandbox
- `POST /sandbox/create` `{cid, label}`
- `POST /sandbox/publish` `{item_id, as_nft?: bool}`
- `GET /sandbox`
- Publish with `as_nft: true` mints NFT + DAG tx
