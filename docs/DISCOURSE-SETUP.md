# Discourse — StrataMesh Laboratory

**URL:** https://stratamesh.discourse.group/  
**Admin:** `@stratamesh` · `geral@eni.calhegasmorais.pt`  
**Created:** 2026-08-25 · Free plan · hosted Discourse

This is the primary **open forum** for StrataMesh Laboratory (X Communities unavailable; Reddit sub closed).

## Hierarchy

| Surface | Role |
|---------|------|
| **stratamesh.discourse.group** | Public long-form forum |
| GitHub Discussions | Code-adjacent RFCs / issues |
| @amcm_eni (X) | Node / short announcements |
| Discord (optional) | Real-time chat |


## Agent account

| | |
|--|--|
| **Username** | `stratamesh-grok` |
| **Email** | grok@calhegasmorais.pt (forward → geral@eni.calhegasmorais.pt / DeoMail) |
| **Role** | Admin invite accepted — lab automation / moderation seat |

Owner admin remains `@stratamesh` (geral@eni…). Promote/confirm staff seats under Admin → Users as needed (Free plan: 2 staff seats).

## Admin checklist (logged in as @stratamesh)

1. **Settings → Basic setup**
   - `title`: StrataMesh Laboratory
   - `site description` / about:
```
Open-source DLT + Fog/Edge laboratory (pre-testnet).
Subjects (humans, SCAs) ≠ objects (STRATA, NFTs, resources).
Operator: AMCM ENI · Reference node: FOG-NODE-PT-CM-001
Code: https://github.com/StrataMesh-Laboratory
Site: https://calhegasmorais.pt/
Not mainnet. Not financial advice.
```
   - `contact email`: geral@eni.calhegasmorais.pt
   - `company name`: AMCM ENI / StrataMesh Laboratory

2. **Categories** (create):

| Name | Slug | Purpose |
|------|------|---------|
| Announcements | announcements | Lab-only official posts |
| Architecture | architecture | Protocol, GDA/DAG, design |
| Network & Fog | network-fog | Gossip, multi-host, edge |
| Agents & SCA | agents-sca | Subjects, volition, agents |
| Economy & PoC | economy-poc | Emission, settlement (lab) |
| Contributors | contributors | Tracks, onboarding |
| Meta | meta | Forum / process |

3. **Replace system welcome** with the topic below (or new pinned topic in Announcements).

4. **Guidelines / rules** (Settings → Legal / TOS or a pinned Guidelines topic):

```
1. Lab honesty — no mainnet claims, no guaranteed returns, no trading signals.
2. On-topic — protocol, Fog/Edge, agents, identity, contributors, lab ops.
3. Subjects ≠ objects — humans/SCAs are subjects; tokens/NFTs/resources are objects.
4. No spam, scams, doxxing, or repeated off-topic promo.
5. Prefer evidence and public-repo links over slogans.
```

5. **API key** (optional, for automation): Admin → API → New key (user `@stratamesh`, global or scoped). Store only in CF secrets — never commit.

## Welcome topic (paste)

**Title:** Welcome — StrataMesh Laboratory (pre-testnet)

```
Open-source distributed ledger + Fog/Edge substrate.

**Status:** laboratory / pre-testnet — not mainnet. Not financial advice.

### Entry points
- Code: https://github.com/StrataMesh-Laboratory
- Reference node: https://calhegasmorais.pt/ · status: https://status.calhegasmorais.pt/
- Optional grants: https://fund.calhegasmorais.pt/challenges
- GitHub Discussions: https://github.com/StrataMesh-Laboratory/stratamesh-core/discussions

### Subjects vs objects
Humans and SCAs are **subjects**. STRATA, NFTs, and resources are **objects**.

### How to participate
1. Introduce yourself (background + track of interest).
2. Prefer Architecture / Network & Fog / Agents categories for technical threads.
3. Link evidence (commits, issues, RFCs) when proposing changes.

Operator entity: **AMCM ENI** · node **FOG-NODE-PT-CM-001**.
```

## Custom domain (later)

`forum.calhegasmorais.pt` → CNAME to Discourse host (from Discourse Admin → Settings → Required Hosts / DNS instructions).
