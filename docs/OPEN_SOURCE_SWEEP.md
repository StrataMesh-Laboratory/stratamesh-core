# StrataMesh / CMN — Open-source sweep (free API / SDK paths)

Scope: GitHub projects whose **mechanics or free HTTP/JS APIs** can align with the Nó Calhegas Morais without paid add-ons.  
Rule: absorb **models**, not foreign ontology. STRATA mint stays **PdC-only**.

## Priority matrix

| Priority | Domain | Project | License | Free path | StrataMesh surface |
|----------|--------|---------|---------|-----------|-------------------|
| P0 | DAG tips | IOTA tip-select specs (TIP-3, R-URTS) | Apache-2.0 | Algorithm only (no paid RPC required) | `stratamesh-consensus` MCMC + non-lazy tips |
| P0 | Gossip | Hedera docs (gossip-about-gossip, virtual voting) | Proprietary chain; **algorithm public** | Local event graph | `stratamesh-gossip` + `virtual_voting` |
| P0 | DePIN | [akash-network](https://github.com/akash-network) SDL | Apache-2.0 | SDL schema as order language | `stratamesh-depin` + SDL-lite |
| P0 | Agents | [valory-xyz/open-autonomy](https://github.com/valory-xyz/open-autonomy), [open-aea](https://github.com/valory-xyz/open-aea) | Apache-2.0 | Patterns (MAS, shared state); Python not on Workers | `stratamesh-agent-services` |
| P0 | IPFS | [ipfs/helia](https://github.com/ipfs/helia), [kubo](https://github.com/ipfs/kubo), public gateways | Apache-2.0 / MIT | Public gateway HTTP, CID verify | `stratamesh-ipfs` |
| P1 | Identity holonic | [urbit/azimuth-js](https://github.com/urbit/azimuth), [js-http-api](https://github.com/urbit/js-http-api) | MIT | Optional read of hierarchy metaphors | Holons Fog→Edge mapping |
| P1 | CID / IPLD | [multiformats](https://github.com/multiformats), [ipld](https://github.com/ipld) | Apache/MIT | Pure JS, Workers-safe | DAG pin path |
| P1 | Agents CF | [openma-ai/open-managed-agents](https://github.com/openma-ai/open-managed-agents) | OSS | Designed for CF Workers + D1 | Future SCA harness |
| P1 | P2P DB patterns | [orbitdb/orbitdb](https://github.com/orbitdb/orbitdb), [amark/gun](https://github.com/amark/gun) | MIT | Browser/edge; needs IPFS or WebRTC | Lab only |
| P2 | Holochain | [holochain/holochain-client-js](https://github.com/holochain/holochain-client-js) | Apache-2.0 | Needs local conductor | Not edge-native |
| P2 | Render/Akash deploy | provider daemons | Apache-2.0 | Heavy k8s — **not** Workers | Fog hardware later |
| P2 | Payments | [x402-cloudflare-starter](https://github.com/ANAMIZED/x402-cloudflare-starter) | MIT | CF Workers USDC | ENI pay parallel |
| P2 | Compute edge | [@computesdk/cloudflare](https://www.npmjs.com/package/@computesdk/cloudflare) | — | CF Sandbox bridge | Optional lab sandbox |

## Prior parallels — refined status

### IOTA → GDA
- **Integrated:** cumulative weight, R-URTS-style non-lazy pool, MCMC α tip pick, tip-sample confidence module.
- **Not integrated:** live attachment to IOTA mainnet (unnecessary; CMN is its own TRD).
- **Free OSS to reuse later:** algorithm text from [IOTA-2.0 tip selection](https://github.com/iotaledger/IOTA-2.0-Research-Specifications); visual ideas from tangle visualisers (UI only).

### Hedera → gossip + virtual voting
- **Integrated:** event = (ts, txs, selfParent, otherParent, hash); lab 2/3 fame vote without vote messages.
- **Not integrated:** full aBFT hashgraph (explicitly lab).
- **Free:** protocol description only; no free production Hedera mirror required for CMN logic.

### Akash / Render → DePIN
- **Integrated:** provider register, reverse auction, bid, lease, escrow book-entry, settle; resource **class** pricing.
- **Refined:** SDL-lite YAML/JSON accept on `/orders/create` (`sdl` field).
- **Not integrated:** Akash chain AKT, Kubernetes provider daemon (Fog metal later).
- **Free OSS:** [akash-network/docs SDL](https://github.com/akash-network/docs) as schema reference.

### Fetch.ai / Olas → SCA services
- **Integrated:** multi-SCA service register, join, shared state tick, pds_min gate note.
- **Not integrated:** Tendermint consensus gadget binary, Open Autonomy full stack (Python).
- **Free OSS:** conceptual model from open-autonomy / open-aea READMEs.

### Urbit → holonic identity
- **Integrated:** Fog as sovereign point; Edge as indexed moons; identity ≠ appointment.
- **Not integrated:** Azimuth Ethereum PKI, running a ship.
- **Free OSS:** [azimuth-js](https://github.com/urbit/azimuth-js) only if/when bridging external identity reads.

## IPFS (edge + fog)
| Tool | Use on CMN |
|------|------------|
| Public gateways (`ipfs.io`, `dweb.link`, `cf-ipfs.com`) | Free read of CIDs |
| Helia (browser) | Client-side verify later |
| Kubo RPC | Fog node when local server exists |
| Existing `stratamesh-ipfs` | Pin / CID ledger on Workers |

## Explicit non-goals (cost / substrate)
- Paid Infura/Alchemy as hard dependency
- Full Akash provider on free Workers
- Running Urbit ship or Holochain conductor on CF free tier
- Importing PoW or chain-native gas tokens into STRATA mint path

## Live API (CMN)
- `/api/v1/consensus/*` — IOTA-inspired tips + modules  
- `/api/v1/gossip/*` — Hedera-inspired events  
- `/api/v1/depin/*` — Akash-inspired market (+ SDL-lite)  
- `/api/v1/agent-services/*` — Olas-inspired MAS  
- `/api/v1/ipfs/*` — CID / pin  
- `/api/v1/integrations/health` — catalog probe  

Last sweep: 2026-08-20  
Delta (releases + plan): [OSS-INSPIRE-2026-08.md](./OSS-INSPIRE-2026-08.md) (2026-08-29)
