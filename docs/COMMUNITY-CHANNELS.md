# Community channels — Discourse · GitHub · Node · Hub

**Operator:** AMCM ENI · **Lab:** StrataMesh Laboratory · **Node:** FOG-NODE-PT-CM-001  
**Tone:** open-source protocol lab, not crypto hype.  
**Status:** Discourse **live** · GitHub org **live** · Hugging Face Hub **live (catalog)** · Reddit discontinued (ban) · Discord not primary

---

## Channel map (canonical)

| Channel | Role | URL | Status |
|---------|------|-----|--------|
| **Discourse forum** | Public discussion, architecture, contributors | https://stratamesh.discourse.group | **Live** |
| **GitHub org** | Code, issues, PRs, releases | https://github.com/StrataMesh-Laboratory | **Live** |
| **GitHub Discussions** | Optional async (code-adjacent) | https://github.com/StrataMesh-Laboratory/stratamesh-core/discussions | Live |
| **Hugging Face Hub** | Catalog of means (not a subject) | https://huggingface.co/stratamesh | **Live (catalog)** |
| **Reference node** | Public FOG node surface | https://calhegasmorais.pt | **Live** |
| **Status** | Pulse / health JSON | https://status.calhegasmorais.pt | **Live** |
| **Impact Fund** | Contributor grants (GitHub evidence) | https://fund.calhegasmorais.pt | Lab V0 |
| **ENI** | Legal entity | https://eni.calhegasmorais.pt | Live |
| Contact | Professional | `geral@eni.calhegasmorais.pt` | Live |

### Division of labour
| Surface | Owns |
|---------|------|
| **GitHub** | Source of truth for code, CI, issues, PRs, roadmaps |
| **Discourse** | Human discussion, design critique, onboarding narrative |
| **Hugging Face Hub** | Objects / means: dataset card, private desk model card, static org Space, Xet bucket catalog |
| **calhegasmorais.pt** | Public node, portal, status, fund UI |
| **DeoMail ENI** | Operational mail (`geral@` / `noreply@eni…`) |

Hub inference is a **separate prepaid meter** (HOLD). See [HUB.md](./HUB.md) and [ops/METABOLISM.md](../ops/METABOLISM.md).

---

## Discourse — StrataMesh Laboratory

- **URL:** https://stratamesh.discourse.group  
- **Auth:** Discourse ID (email / social)  
- **Staff:** `@stratamesh` (owner) · `@stratamesh-grok` (ops / automation)  
- **Contact setting:** `geral@eni.calhegasmorais.pt`

### Categories
| Category | Purpose |
|----------|---------|
| Announcements | Official lab notices (staff) |
| Architecture | DAG, finality, protocol design |
| Network & Fog | Nodes, gossip, multi-host |
| Agents & SCA | Roles, clearance |
| Economy & PoC | Lab economics (conceptual only) |
| Contributors | Onboarding, Impact Fund, grants |
| Meta | Forum + cross-links |
| General / Site Feedback | Catch-all |

### Pinned
- Welcome — StrataMesh Laboratory (pre-testnet)  
- Guidelines  
- Canonical channels — GitHub, node, fund, Hub  

Setup runbook: [DISCOURSE-SETUP.md](./DISCOURSE-SETUP.md)

---

## GitHub — StrataMesh-Laboratory

| Repo | Role |
|------|------|
| [stratamesh-core](https://github.com/StrataMesh-Laboratory/stratamesh-core) | Protocol / node reference |
| [calhegas-morais-node](https://github.com/StrataMesh-Laboratory/calhegas-morais-node) | FOG-NODE-PT-CM-001 surface |
| [stratamesh-laboratory](https://github.com/StrataMesh-Laboratory/stratamesh-laboratory) | Lab meta |
| [stratamesh-impact-fund](https://github.com/StrataMesh-Laboratory/stratamesh-impact-fund) | Fund app |
| [.github](https://github.com/StrataMesh-Laboratory/.github) | Org profile / templates |

**Contributor path:** issue/PR on GitHub → discussion on Discourse when needed → Fund metrics from GitHub evidence.

---

## Hugging Face — stratamesh

| Object | Kind | URL | Note |
|--------|------|-----|------|
| Org | — | https://huggingface.co/stratamesh | Admin `calhegasmorais` |
| `stratamesh/README` | static Space | https://huggingface.co/spaces/stratamesh/README | Org card. Free. |
| `stratamesh/lab` | dataset | https://huggingface.co/datasets/stratamesh/lab | Public facts. No weights/tokens/secrets. |
| `stratamesh/edge-grok` | model (private) | https://huggingface.co/stratamesh/edge-grok | Desk means, not a being. |
| `stratamesh/RealworldQA-bucket` | bucket | https://huggingface.co/buckets/stratamesh/RealworldQA-bucket | Catalog only. Never download onto Fog. |

HF Inference Providers: $0.10/mo prepaid, `canPay=false`, HOLD until 1 Sep 2026 00:00 UTC. Whoami + catalog stay live. No workers.dev. No plan upgrade.

Full map: [HUB.md](./HUB.md).

---

## Live node surfaces

| Host | Role |
|------|------|
| https://calhegasmorais.pt | SPA / portal |
| https://status.calhegasmorais.pt | Operational pulse |
| https://fund.calhegasmorais.pt | Impact Fund V0 |
| https://eni.calhegasmorais.pt | AMCM ENI |

---

## Out of scope / retired

| Channel | Note |
|---------|------|
| Reddit `r/StrataMesh_DLT` | Banned — live splash 2026-08-28 “community is banned”. redditrequest removed by filters. Do not post. Do not recreate under alt accounts. |
| X Communities | Not creatable for this use case |
| Discord as primary | Optional later; Discourse is the forum of record |
| HF Inference / bucket pull | Metered or huge; HOLD / never on Fog |

---

## Lab honesty (all channels)

1. Pre-testnet / lab — not mainnet.  
2. Subjects ≠ objects. Hub is means.  
3. No financial advice; no guaranteed returns.  
4. Prefer commits, tests, and public status over slogans.

*Last updated: 2026-08-28 — Hub catalog linked under metabolic stasis.*
