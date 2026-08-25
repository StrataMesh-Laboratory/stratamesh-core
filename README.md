# StrataMesh Core

**Release:** [v0.2.1-lab](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.2.1-lab) — reference Fog node (**not mainnet**)

**STRATA** is the exclusive foundational token: fungible settlement **and** tokenisation to STRATA NFTs (open worlds, CGU/UGC by users **and** SCAs, external-asset representatives on the DLT). Monetary poles: **`#mint`** (emit-only via PoC) and **`#0`** (burn sink on resource use — never transfers out). Circulating supply excludes `#0`. Fog Node **Calhegas Morais** (`FOG-NODE-PT-CM-001`) · Lisbon  
Motto: *Intelligentia · Vigilantia · Veritas*

## Monetary poles (STRATA)
| Address | Role |
|---------|------|
| `#mint` | Emission source only — creates via PoC; never receives; no spendable balance |
| Wallets | Circulation (nodes, users, SCAs) |
| `#0` | Burn sink — receives on resource use; never transfers out |

API: `GET https://stratamesh-token.stratamesh.workers.dev/monetary` · `POST /burn`

## Public pulse
- Status JSON: https://stratamesh-status.stratamesh.workers.dev/status
- Live dashboard: https://stratamesh-status.stratamesh.workers.dev/live
- Site: https://calhegasmorais.pt/

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
| **LAB** | Reference node · wire + threat drafts · single-process benchmark |
| **Adversarial lab** | Multi-host gossip + chaos · I1–I6 CI · resource-proof MVP |
| **Public testnet** | Frozen wire · external join · still not mainnet |
| **Mainnet** | Explicit decision after evidence — unscheduled |

Whitepaper phases 0–7 remain theme labels only. Control law: [docs/ROADMAP-PUBLIC-v0.3.md](docs/ROADMAP-PUBLIC-v0.3.md).

Docs: [`ROADMAP-PUBLIC-v0.3.md`](docs/ROADMAP-PUBLIC-v0.3.md) · [v0.2 historical](docs/ROADMAP-PUBLIC-v0.2.md) · `docs/PHASE*-SCAFFOLD.md` · `docs/RELEASE-v0.2.1-lab.md` · `docs/OPS-RUNBOOK.md`

## Roadmap (summary)
Lab freeze **v0.2.1-lab** exercises whitepaper pillars in-process. Production splits into:
- **Track A — Mesh reality:** always-on node → multi-host gossip → multi-operator SPAs → public testnet
- **Track B — Protocol depth:** emission policy → dual-asset Agora → meta-finality → real ACB meters → real PQ

Full detail: [docs/ROADMAP-PUBLIC-v0.3.md](docs/ROADMAP-PUBLIC-v0.3.md)

## Hybrid Orchestrator
Federated meta-learning controller (probabilistic + symbolic lobes, QIGA):
```bash
cd src && python3 -m orchestrator.meta_controller
```


## Subject–Object Economy

**Subjects** (humans, SCAs) act, agree, and own. **Objects** (STRATA, NFTs, resources) are owned and used — never the reverse for NFTs.

A human or SCA may own STRATA/NFTs; a human does not “own” an SCA as they own a token. SCA↔SCA relations are among subjects. Population = subjects only (not tokens or NFTs as citizens).

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
  └─ Virtual Domain → World → Sandbox → User | SCA
```

- **Civil time:** CLP (`/clp`); **wire time:** ISO-8601 for DAG/interop.
- Orchestrator `/health` and Status `/status` expose `foundation` + `clp`.
- Docs: `docs/HOLONIC-LAYERS.md`, `docs/TEMPORALIDADE-CLP.md`.


## Current lab surface (CMN)

| Area | Status |
|------|--------|
| Holonic inhabitance | Personal UGC/CGU sandbox per SCA (STRATA NFTs); open worlds as STRATA NFTs; open-world co-presence (SCA + users) |
| Temporal kernel | CLP/PPC at Node locus **Lisbon**; ISO-8601 as carrier only |
| SCA volition | Self-scheduled `next_volition_at`; dispatcher honours queue / soft nudge only |
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
| Fetch.ai / Olas | Multi-SCA agent services + shared-state gadget — `/api/v1/agent-services` |
| Urbit | Holonic Fog→Edge identity; Metaverse OS layers |

Details: [`docs/PARALLELS.md`](docs/PARALLELS.md). STRATA mint remains **PoC-only**.
