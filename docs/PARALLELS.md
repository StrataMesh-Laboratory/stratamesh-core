# StrataMesh / CMN — Technological Parallels (Lab implementation)

This document maps external systems to **operational** StrataMesh mechanics.
Parallels are inspirational, not forks: STRATA mint remains **PdC-only**; identity of SCA ≠ appointment; resource class ≠ function.

## IOTA (Tangle) → GDA / consensus

| IOTA idea | StrataMesh implementation |
|-----------|---------------------------|
| DAG tips, no linear chain | `stratamesh-dag` vertices + tip pool |
| Cumulative weight | DAG + consensus `cw_threshold` / weight-mapped confidence |
| MCMC α-biased tip selection | `GET /api/v1/consensus/tips` — R-URTS + MCMC α |
| Confirmation confidence | Module `tip_sample_confidence` |
| Non-lazy tips | Tip scoring LAZY / SEMI_LAZY / NON_LAZY |

## Hedera Hashgraph → gossip + virtual voting

| Hedera idea | StrataMesh implementation |
|-------------|---------------------------|
| Gossip-about-gossip events | `POST /api/v1/gossip/sync` — event = (ts, txs, selfParent, otherParent, hash) |
| Hashgraph of communication | `gossip_events` in D1; `GET /api/v1/gossip/events` |
| Virtual voting (no vote messages) | Consensus module `virtual_voting` (lab 2/3 fame; **not** production aBFT) |
| Fair ordering / median time | Lab timestamp on event; full median-order TBD |

## Akash Network & Render → DePIN market

| DePIN idea | StrataMesh implementation |
|------------|---------------------------|
| Provider capacity + pricing | `POST /api/v1/depin/providers/register` |
| Reverse auction orders | `POST /api/v1/depin/orders/create` + bids |
| Lease + escrow | `POST /api/v1/depin/leases/accept` — escrow in STRATA units |
| Settle to provider | `POST /api/v1/depin/leases/settle` |
| Resource-class pricing | storage \| compute \| bandwidth \| render \| memory — **function never sets rate** |
| Capital recovery | Aggregate STRATA income supports Q_C; leases **do not mint** |

## Fetch.ai (ASI) & Olas (Autonolas) → SCA agent services

| Agent idea | StrataMesh implementation |
|------------|---------------------------|
| Autonomous economic agents | SCA registry + labour paid in STRATA (no mint) |
| Multi-agent service | `POST /api/v1/agent-services/register` |
| Shared off-chain state + gadget | `POST /api/v1/agent-services/tick` (lab 2/3 acks) |
| PdS gate | `pds_min` on service; ACB enforces subsistence |
| Identity ≠ role | SCA id independent of orchestrator appointment |

## Urbit → holonic identity & personal node

| Urbit idea | StrataMesh mapping |
|------------|-------------------|
| Ship as personal server | Fog Node (CMN) as sovereign operational point |
| Moons / satellites | Edge nodes indexed under Fog |
| Galaxy / sponsorship | Mesh-level naming & routing (holon hierarchy) |
| Azimuth-like identity | Document KYC + username; legal name internal |
| Layered OS | SO Metaverso → Domínio Virtual → Mundo Aberto → Bancada CGU |

## Endpoints (production domain)

- `https://calhegasmorais.pt/api/v1/consensus/*`
- `https://calhegasmorais.pt/api/v1/gossip/*`
- `https://calhegasmorais.pt/api/v1/depin/*`
- `https://calhegasmorais.pt/api/v1/agent-services/*`

Workers: `stratamesh-consensus@3.0.0-virtual-vote-iota`, `stratamesh-gossip@2.0.0-hashgraph-fragment`, `stratamesh-depin@1.0.0-akash-render-parallel`, `stratamesh-agent-services@1.0.0-olas-fetch-parallel`.
