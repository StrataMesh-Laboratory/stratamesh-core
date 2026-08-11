# Holonic layers — StrataMesh Web3 / Metaverse stack (lab)

Aligned with whitepaper pillars (DAG + IPFS + Fog/SPA + apps) and Phase 4–5 scaffolds.

| Layer | Holon | Worker / module | Role |
|------:|-------|-----------------|------|
| 0 | **Substrate** | `stratamesh-dag` + `stratamesh-ipfs` | Ledger events (DAG) + content-addressed data (IPFS CIDv1) |
| 1 | **Sandbox** | `stratamesh-sandbox` / `src/sandbox.py` | UGC drafts; create → optional publish as NFT |
| 2 | **World** | `stratamesh-worlds` | Experience namespaces; multi-user open-world containers |
| 3 | **Realm** | `stratamesh-realms` | Sovereignty / governance under SPA (operator or DAO) |
| 4 | **Economy** | token, PoC, Agora | STRATA fungible + NFT; contribution mint; listings |
| 5 | **Agency** | ACB, Republic, Orchestrator | Autonomous agents + subsistence + hybrid controller |

**Flow (lab):** Sandbox create (CID) → publish (+ NFT) → attach to World → World lives in Realm under SPA.

**IPFS (v3):** CIDv1 raw+sha2-256 (`bafkrei…`); content on R2 `stratamesh-fog` + KV; gateway `GET /ipfs/{cid}`. Optional Pinata if `PINATA_JWT` set. Public gateways resolve only after announcement/Pinata.
