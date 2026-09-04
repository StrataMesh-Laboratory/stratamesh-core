# StrataMesh Core

**Release:** [v0.5.1-lab](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.5.1-lab) — **Adversarial LAB phase P1**. Live/lab version is **v0.5.1-lab**, not 0.4.1. Mesh **n=2**: Mac Fog `FOG-NODE-PT-CM-001` + EDGE-GROK local `EDGE-GROK-CMN-001`. **Not mainnet.** Public `https://fog.calhegasmorais.pt/health` may still JSON `n=1` `origin=session` `mac_live=false` — that is a **session-origin software flag**, not “the lab is n=1”. Do not treat that JSON as `mac_live=true`.

**STRATA** is the exclusive foundational token: fungible settlement **and** tokenisation to STRATA NFTs (open worlds, CGU/UGC by users **and** ACBs, external-asset representatives on the DLT). Monetary poles: **`#mint`** (emit-only via PoC) and **`#0`** (burn sink on resource use — never transfers out). Circulating supply excludes `#0`. Fog Node **Calhegas Morais** (`FOG-NODE-PT-CM-001`) is the reference; other operators instantiate via the [Fog Node kit](deploy/fog-node/README.md).  
Motto: *Intelligentia · Vigilantia · Veritas*

## Monetary poles (STRATA)
| Address | Role |
|---------|------|
| `#mint` | Emission source only — creates via PoC; never receives; no spendable balance |
| Wallets | Circulation (nodes, users, ACBs) |
| `#0` | Burn sink — receives on resource use; never transfers out |

API: `GET https://calhegasmorais.pt/api/v1/token/monetary` · `POST /api/v1/token/burn`

## Public pulse
- Status JSON: https://status.calhegasmorais.pt/status
- Live dashboard: https://status.calhegasmorais.pt/live
- Site: https://calhegasmorais.pt/
- Fog: https://fog.calhegasmorais.pt/ · probe `GET /health` → `"origin": "session"|"macbook"` (one named-tunnel connector)
- Gossip: https://gossip.calhegasmorais.pt/
- Origin: https://origin.calhegasmorais.pt/ — staff archive + same fog origin flux ([deploy/mac-fog](deploy/mac-fog))
- Hub (catalog): https://huggingface.co/stratamesh
- Academy (ACB training): https://academy.calhegasmorais.pt/

## Ops (lab)
```bash
./scripts/run_fog_node.sh
./scripts/publish_loop.sh          # separate terminal
cd src && python3 mesh_doctor.py   # full-stack self-check
```

Optional Kubo pins: `export IPFS_API_URL=http://127.0.0.1:5001`

## Promotion ladder (lab → mainnet)

| Stage | Focus |
|-------|--------|
| **LAB** | Reference node · wire + threat drafts · single-process benchmark — *exited for the CMN pair* |
| **Adversarial lab (current · P1)** | Two-host mesh (Fog Mac + EDGE-GROK local) · I1–I6 CI · resource-proof MVP. grok90 two-host INV/TX evidence pack is a **later bar**, not the current phase name |
| **Public testnet** | Frozen wire · external join · still not mainnet |
| **Mainnet** | Explicit decision after evidence — unscheduled |

Whitepaper phases 0–7 remain theme labels only. Control law: [docs/ROADMAP-PUBLIC-v0.3.md](docs/ROADMAP-PUBLIC-v0.3.md).

Docs: [`ROADMAP-VISION.md`](docs/ROADMAP-VISION.md) · [`ROADMAP-PUBLIC-v0.3.md`](docs/ROADMAP-PUBLIC-v0.3.md) · [v0.2 historical](docs/ROADMAP-PUBLIC-v0.2.md) · `docs/PHASE*-SCAFFOLD.md` · `docs/RELEASE-v0.5.1-lab.md` · `docs/OPS-RUNBOOK.md` · [`HUB.md`](docs/HUB.md)

## Roadmap (summary)
**v0.5.1-lab** Adversarial P1: two distinct hosts (Mac Fog `FOG-NODE-PT-CM-001` continuous + EDGE-GROK local `EDGE-GROK-CMN-001`). Production splits into:
- **Track A — Mesh reality:** always-on node → multi-host gossip → multi-operator SPAs → public testnet
- **Track B — Protocol depth:** emission policy → dual-asset Agora → meta-finality → real ACB meters → real PQ

Full detail: [docs/ROADMAP-PUBLIC-v0.3.md](docs/ROADMAP-PUBLIC-v0.3.md)

## Paradigm (vision, not live)

The terminal is not the computer. A subject requests a **capability**; the fabric allocates measured physical resources; evidence and a **Resource Receipt** settle in STRATA. Device envelope ≠ accessible computational envelope.

| Milestone | Objective | Now |
|-----------|-----------|-----|
| I Laboratory protocol | DAG, gossip, STRATA, workers | **v0.5.1-lab** |
| II Adversarial multi-host | two hosts, chaos, resource-proof MVP | **P1 in progress** |
| III Fog appliance | dedicated measurable machine | proposed — [FOG-APPLIANCE.md](docs/FOG-APPLIANCE.md) |
| IV Resilient infrastructure | 2×2 m hut, dual WAN/energy | proposed — [FOG-INFRASTRUCTURE.md](docs/FOG-INFRASTRUCTURE.md) |
| V Public testnet | offers, allocation, external demand | unscheduled |
| VI Metaversal OS | worlds, SCAs, volition | holon labels on the node |
| VII Terminalization | interface ≠ compute location | vision |
| VIII Global fabric | geo / energy / resilience scheduling | vision |
| IX Mature mainnet | full intention→receipt→state loop | explicit decision after evidence |

Full vision: [docs/ROADMAP-VISION.md](docs/ROADMAP-VISION.md) · spine [docs/FOG-STACK.md](docs/FOG-STACK.md) · site `/fog-stack`


## Hybrid Orchestrator
Federated meta-learning controller (probabilistic + symbolic lobes, QIGA):
```bash
cd src && python3 -m orchestrator.meta_controller
```



## Community

| Channel | URL |
|---------|-----|
| **Forum** | [stratamesh.discourse.group](https://stratamesh.discourse.group) |
| **GitHub org** | [StrataMesh-Laboratory](https://github.com/StrataMesh-Laboratory) |
| **Hugging Face** | [huggingface.co/stratamesh](https://huggingface.co/stratamesh) |
| **Reference node** | [calhegasmorais.pt](https://calhegasmorais.pt) |
| **Status** | [status.calhegasmorais.pt](https://status.calhegasmorais.pt) |
| **Impact Fund** | [fund.calhegasmorais.pt](https://fund.calhegasmorais.pt) |
| Contact | `geral@eni.calhegasmorais.pt` |

Forum = discussion · GitHub = code · Hub = catalog of means (not inference) · Node = public lab surface. See [docs/COMMUNITY-CHANNELS.md](docs/COMMUNITY-CHANNELS.md) · [docs/HUB.md](docs/HUB.md).

HF Inference Providers stay **HOLD** until the $0.10/mo prepaid grant refills (1 Sep 2026 00:00 UTC, `canPay=false`). Whoami and bucket catalog are live. Do not pull the RealworldQA bucket onto Fog.

## Contributors (testnet funnel)

We cultivate **open-source engineers already shipping** in adjacent ecosystems (libp2p, KubeEdge, Golem/Akash, IPFS, agents, simulation) — not a generic “crypto hiring” funnel.

- [`docs/COMMUNITY-OUTREACH-MAP.md`](docs/COMMUNITY-OUTREACH-MAP.md) · [`docs/CONTRIBUTOR-TRACKS.md`](docs/CONTRIBUTOR-TRACKS.md) · [`docs/WANTED.md`](docs/WANTED.md)
- Incentives: [Impact Fund](https://fund.calhegasmorais.pt/) · [Sponsors](https://github.com/sponsors/amcmorais) · Issues `track:*` / `impact-challenge`

## Subject–Object Economy

**Subjects** (humans, ACBs) act, agree, and own. **Objects** (STRATA, NFTs, resources) are owned and used — never the reverse for NFTs.

A human or ACB may own STRATA/NFTs; a human does not “own” an ACB as they own a token. ACB↔ACB relations are among subjects. Population = subjects only (not tokens or NFTs as citizens).

Normative: [`docs/SUBJECT-OBJECT-ECONOMY.md`](docs/SUBJECT-OBJECT-ECONOMY.md) · live NFT: `Agent owns/operates NFT — never NFT owns Agent`.

## Epistemic stance
Substrate-neutral standing — function and agreement before substrate.  
See `docs/EPISTEMIC-ONTOLOGY.md`.

## Licence
MIT — see `LICENSE`

## Holonic foundation & CLP time

Source of truth: `shared/holonic-clp.js` (embedded into edge workers).

```
STRATAMESH DLT → Node (OS/VM) → Web3 Metaverse OS (shared)
  ├─ CLP temporal kernel (civil time)
  ├─ Dashboard / Portal (OS apps, inside the holarchy)
  └─ Virtual Domain → World → Sandbox → User | ACB
```

- **Civil time:** CLP (`/clp`); **wire time:** ISO-8601 for DAG/interop.
- Orchestrator `/health` and Status `/status` expose `foundation` + `clp`.
- Docs: `docs/HOLONIC-LAYERS.md`, `docs/TEMPORALIDADE-CLP.md`.


## Current lab surface (CMN)

| Area | Status |
|------|--------|
| Holonic inhabitance | Personal UGC/CGU sandbox per ACB (STRATA NFTs); open worlds as STRATA NFTs; open-world co-presence (ACB + users) |
| Temporal kernel | CLP/PPC at Node locus **Lisbon**; ISO-8601 as carrier only |
| ACB volition | Self-scheduled `next_volition_at`; dispatcher honours queue / soft nudge only |
| Computational Republic | SCA-only associative DAO — distinct from Node operations |
| Workers (ACB) | `stratamesh-acb` ≥ 5.11 · senses, holon/ensure, world presence |

Public site: [calhegasmorais.pt](https://calhegasmorais.pt/) · CLP UI: [/clp](https://calhegasmorais.pt/clp)



## KYC · OCR + ICAO 9303

- **Worker:** `stratamesh-kyc-ocr` — Workers AI `@cf/llava-hf/llava-1.5-7b-hf` extracts MRZ from passport photos; ICAO Doc 9303 check digits validate structure (open standard, same family as OmniMRZ / mrz-fast).
- **Auth:** `POST /kyc/submit` binds `sovereign_id`, internal `full_name_legal`, unlocks panel when auto score ≥ 0.8.
- **Register:** requires `terms_accepted`; invite link sets password; login uses email 2FA.
- **Endpoints:** `POST https://stratamesh-kyc-ocr.stratamesh.workers.dev/ocr` (multipart `image`), `/kyc-from-image` with Bearer to chain into auth.


## Technological parallels (lab)

StrataMesh absorbs **mechanics** from adjacent systems without copying their ontology:

| Parallel | StrataMesh surface |
|----------|-------------------|
| IOTA Tangle | DAG cumulative weight, MCMC tip selection, confirmation confidence — `/api/v1/consensus` |
| Hedera Hashgraph | Gossip-about-gossip events + lab virtual voting — `/api/v1/gossip`, consensus `virtual_voting` |
| Akash / Render | DePIN reverse auction, STRATA escrow leases — `/api/v1/depin` |
| Fetch.ai / Olas | Multi-ACB agent services + shared-state gadget — `/api/v1/agent-services` |
| Urbit | Holonic Fog→Edge identity; Metaverse OS layers |

Details: [`docs/PARALLELS.md`](docs/PARALLELS.md). STRATA mint remains **PoC-only**.
