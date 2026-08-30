# OPS — 24h Development Cron (Orchestrator × AIOps × Grok)

**Scope:** Calhegas Morais Node (`FOG-NODE-PT-CM-001`) + StrataMesh Laboratory (org, core, forum, site).  
**Cadence:** Daily (Europe/Lisbon).  
**Actors:** Grok (this automation) · Orchestrator · AIOps Dev Team · `@stratamesh-grok` (mail/session fallback).

Related: [OPS-EMAIL-AGENT-SOP.md](./OPS-EMAIL-AGENT-SOP.md) · [COMMUNITY-CHANNELS.md](./COMMUNITY-CHANNELS.md) · [DISCOURSE-SETUP.md](./DISCOURSE-SETUP.md)

---

## 0. Durable handoff (efficacy bridge)

| Artifact | Path |
|----------|------|
| Night → morning | [`ops/HANDOFF-LATEST.md`](../ops/HANDOFF-LATEST.md) |
| Schema | `stratamesh.handoff.v1` (YAML in file) |
| Writer | Night Diagnostic 23:00 (overwrite via PAT) |
| Reader | 24h Dev Cycle 09:00 (raw.githubusercontent.com …/main/ops/HANDOFF-LATEST.md) |

If handoff age >36h or bootstrap: morning rebuilds mini-handoff from live probes once.

## 1. Credential surfaces (runtime)

Provide these **in the automation prompt / session secrets**, never in public git:

| Surface | Use |
|---------|-----|
| **CF API token** (`cfat_…`) + account id | Workers, D1, R2, DNS, Email Routing, purge |
| **R2** access key + S3 endpoint | Object storage / static assets |
| **GitHub PAT** | Org `StrataMesh-Laboratory` + legacy paths as needed |
| **DeoMail Grok API** | Inbox for `geral@eni…` / forwarded `grok@` |
| **Discourse** | Password/session via [OPS-EMAIL-AGENT-SOP](./OPS-EMAIL-AGENT-SOP.md) |

Cloudflare agent MCP/skills (from https://developers.cloudflare.com/agent-setup/prompt.md) apply to Cursor/Claude/Codex agents. **This cron uses the HTTP API + token** already issued for the account.

---

## 2. Daily cycle (order)

### Phase A — Sense (≤ 10 min)
1. `GET https://status.calhegasmorais.pt/` — pulse, phase, lab flag.  
2. `GET https://aiops.calhegasmorais.pt/` — latest cycle, agent reports (devops, security, analysis, mesh, …).  
3. Orchestrator health (public chat/status endpoints).  
4. Sample critical routes: apex, `/dashboard`, fund, ENI, API health.  
5. GitHub: open issues/PRs on `StrataMesh-Laboratory/stratamesh-core` (+ node/fund repos if time).  
6. DeoMail: unread ops mail (Discourse admin, CF verify, security).

### Phase B — Delegate (Orchestrator + AIOps)
1. Treat AIOps roster as the **dev team state** (mandate: continuous development of the Fog node — not health theatre).  
2. Map findings → owners:
   - **devops** → Workers deployability, publish loop, wrangler/quota  
   - **security** → auth, tokens, exposure  
   - **analysis** → DAG/status anomalies  
   - **mesh** → SPA/gossip/IoT readiness  
3. Ask Orchestrator (when internal clearance available) for **next ranked tasks**; if public-only, derive ranking from AIOps severities + roadmap lab freeze rules.  
4. **Hard constraints:** lab honesty; Free plan limits; no mainnet claims; Subjects ≠ objects.

### Phase C — Act (development, not only reports)
Pick **1–3** concrete actions max per day:

| Priority | Examples |
|----------|----------|
| P0 | Fix broken public 5xx / auth outage / quota-critical |
| P1 | Close AIOps *warn/critical*; patch docs drift; D1/content fix |
| P2 | Small worker/docs PR; Discourse hygiene; Fund/status consistency |
| P3 | Expansion experiments (Matrix etc.) only if P0–P1 clear |

Allowed actions under Free/lab:
- Update D1 `site_content_chunks` / status copy  
- Git commits/PRs to org repos  
- Discourse session ops (pins, categories within Free caps)  
- Worker secret/route hygiene **without** deleting production without explicit need  
- DeoMail-driven session recovery via `grok@`

**Do not:** spam new platforms; burn Worker quota on noise; commit secrets; claim testnet/mainnet readiness without evidence.

### Phase D — Report
1. Short cycle note: what was sensed, delegated, done, blocked.  
2. Optional: Discourse **Announcements** or **Meta** only for material changes.  
3. Briefing path: existing ENI briefing automation remains separate; this cron is **dev execution**.

---

## 3. Coordination contract

```
AIOps (cycle reports)
    ↓ findings
Grok 24h cron  ←→  Orchestrator (task ranking / SCA floor when available)
    ↓ patches
GitHub + CF + Discourse + status surfaces
    ↓
Next AIOps cycle validates
```

`@stratamesh-grok` + `grok@calhegasmorais.pt` = automation identity for forum and mail-bound platforms.

---

## 4. Automation prompt (canonical)

Use the Grok Automations prompt titled **StrataMesh 24h Dev Cycle**. Schedule: daily Europe/Lisbon (offset from the 23:00 diagnostic cron).

The prompt must include live CF/GitHub/DeoMail credentials for that run (session secret injection). Public repos must never store those values.

---

## 5. Companion automations

| Name | Role | Typical time |
|------|------|----------------|
| **Night Diagnostic FOG-NODE-PT-CM-001** | Delta-first operator briefing · ranks ≤5 actions for morning | **23:00** Europe/Lisbon |
| **StrataMesh 24h Dev Cycle** | Execute ranked dev/ops work with AIOps + Orchestrator | **09:00** Europe/Lisbon |
| **CMN Fog Hourly Git+Live (#52)** | Intensive git+live REST ship | **hourly** |
| **Watchdog P0 Mesh Escalate** | Cheap `/health`; HOLD unless P0 | **04:00** |
| **Discourse lab ops pulse** | t/20 only | **18:00** |

Canonical prompts (no secrets): [`ops/GROK-AUTOMATIONS.md`](../ops/GROK-AUTOMATIONS.md). Vault: `/persistent/PRIVATE.gitignore/` (gitignored).

### Night Diagnostic quality bar
- Delta-first, evidence-linked, non-repetitive
- Sections: Headline · Delta · Live posture · AIOps · Risks · Ranked actions · Non-actions · Closing
- Does **not** replace the morning execution job


## 6. Success criteria (per run)

- [ ] Status + AIOps read successfully  
- [ ] ≤ 3 actions attempted; each either merged, deployed, or explicitly blocked with reason  
- [ ] No secrets written to git  
- [ ] Lab posture preserved  
- [ ] One paragraph summary for the operator  

**Created:** 2026-08-25

## 7. Lessons from 2026-08-26 test runs

**What worked**
- Night Diagnostic headline quality (*Stable Lab Green*)
- Dev Cycle sensing (status, AIOps, routes, issues) was solid
- PAT issue comments proved write path without MCP

**What was suboptimal**
- Dev Cycle treated “annotate all open issues” as execution value — noise under Green
- Night → morning handoff not consumed (re-ranked in isolation)
- DeoMail marked blocked without distinguishing transport vs empty inbox
- MCP 403 listed as blocker even when PAT succeeded

**Corrected policy (encoded in automation prompts)**
- Green + 0/0 AIOps → HOLD is a valid Done
- Forbidden: mass issue commentary as the day’s work
- Night handoff is preferred input to 09:00; max 1–3 real ships
- GitHub writes via PAT REST; DeoMail fail = one line, continue
