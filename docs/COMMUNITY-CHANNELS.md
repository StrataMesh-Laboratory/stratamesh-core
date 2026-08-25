# Community channels — Discourse · GitHub · Node

**Operator:** AMCM ENI · **Lab:** StrataMesh Laboratory · **Node:** FOG-NODE-PT-CM-001  
**Tone:** open-source protocol lab, not crypto hype.  
**Status:** Discourse **live** · GitHub org **live** · Reddit discontinued (ban) · Discord not primary

---

## Channel map (canonical)

| Channel | Role | URL | Status |
|---------|------|-----|--------|
| **Discourse forum** | Public discussion, architecture, contributors | https://stratamesh.discourse.group | **Live** |
| **GitHub org** | Code, issues, PRs, releases | https://github.com/StrataMesh-Laboratory | **Live** |
| **GitHub Discussions** | Optional async (code-adjacent) | https://github.com/StrataMesh-Laboratory/stratamesh-core/discussions | Live |
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
| **calhegasmorais.pt** | Public node, portal, status, fund UI |
| **DeoMail ENI** | Operational mail (`geral@` / `noreply@eni…`) |

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
- Canonical channels — GitHub, node, fund  

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
| Reddit `r/StrataMesh_DLT` | Banned at creation — not recreated under alt accounts |
| X Communities | Not creatable for this use case |
| Discord as primary | Optional later; Discourse is the forum of record |

---

## Lab honesty (all channels)

1. Pre-testnet / lab — not mainnet.  
2. Subjects ≠ objects.  
3. No financial advice; no guaranteed returns.  
4. Prefer commits, tests, and public status over slogans.

*Last updated: 2026-08-25 — Discourse live + cross-links.*

---

## Expansion probe (2026-08-25)

Goal: reach **protocol/systems engineers** without crypto-hype venues. Keep **Discourse + GitHub** as systems of record.

### Ranking for StrataMesh (lab / Fog / DLT systems)

| Priority | Platform | Fit | Effort | Notes |
|----------|----------|-----|--------|-------|
| **P0** | **GitHub Discussions** (already on) | High | Low | Code-adjacent Q&A; keep in sync with Discourse links |
| **P0** | **Discourse** (live) | High | Done | Long-form, searchable, lab memory |
| **P1** | **Matrix / Element** space | High | Med | Federated real-time; aligns with sovereignty narrative; bridges optional |
| **P1** | **Hacker News** (Show HN / posts when evidence ready) | High | Low | Discovery, not a home; only with working demos/tests |
| **P1** | **Lobsters** | High | Low–Med | High-signal engineering; invite culture |
| **P2** | **Zulip** (cloud free for OSS or self-host) | Med–High | Med | Topic-threaded chat; better than Discord for async protocol work |
| **P2** | **dev.to / Hashnode** long-form | Med | Low | Publishing layer; point back to GitHub + Discourse |
| **P3** | **Stoat** (ex-Revolt) | Med | Med | Discord-like OSS UX if real-time community demands it |
| **P3** | **Lemmy** community | Low–Med | Med | Reddit-shaped but federated; still sparse for DLT systems niche |
| **Defer** | Discord as primary | — | — | Common for OSS but weak search/memory; optional bridge later |
| **Defer** | Telegram | — | — | Poor moderation/search for protocol design |
| **No** | New Reddit sub under alt accounts | — | — | Prior ban risk; policy exposure |
| **No** | X Communities | — | — | Not creatable for this use case |

### Recommended next experiments (order)

1. **Matrix space** `#stratamesh:matrix.org` (or self-hosted homeserver later) — announce on Discourse + GitHub only after room moderation norms exist.  
2. **Show HN** when multi-host gossip or public status story is evidence-backed (link node + repo + forum).  
3. **Zulip** only if Discourse chat is insufficient for day-to-day contributor sync.  
4. Avoid expanding surface area before P0 channels have steady staff response SLAs.

### Selection criteria (use for any new platform)

1. Can we state **lab / pre-testnet** without looking like a token venue?  
2. Is history **searchable** six months later?  
3. Can `@stratamesh-grok` + `grok@` recover access via this SOP?  
4. Does it pull **systems/Fog/DLT** people, not only traders?  
5. Ops cost on Free/OSS path?

*Probe only — no new homes spun up in this commit except documentation.*
