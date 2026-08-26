# AIOps operational loop (formal) — no stubs

**Worker:** `stratamesh-aiops` **v1.7.1-ops-formal**  
**KV:** `stratamesh-ops-state` bound as `AIOPS_KV`  
**Cron:** `0 * * * *` (hourly budgeted cycle)  
**Orchestrator consume (read-only):** `stratamesh-orchestrator` **v10.24.3-actions-proxy** — `GET /actions` and `GET /handoff` proxy `env.AIOPS.fetch`. No ships. No new cron. Torch HOLD. This is **not** 09:00 Dev Cycle fulfillment.

## Authoritative artifacts

| Artifact | Role | Failover |
|----------|------|----------|
| [`ops/HANDOFF-LATEST.json`](../ops/HANDOFF-LATEST.json) | Machine handoff (`stratamesh.handoff.v1`) | Primary for parsers |
| [`ops/HANDOFF-LATEST.md`](../ops/HANDOFF-LATEST.md) | Human + JSON fence | Same content |
| `AIOPS_KV` key `handoff_latest` | Edge cache after POST | Written by Night Diagnostic / ops |
| `GET /actions` | Live delegation | Rebuilds from probes + handoff tiers |
| Orchestrator `GET /api/orchestrator/actions` | Read-only proxy of AIOps `/actions` | Binding `AIOPS` only; honest `{ok:false,error,source:"aiops"}` on failure |
| Orchestrator `GET /api/orchestrator/handoff` | Read-only proxy of AIOps `/handoff` | Same binding; does not POST, does not run `mandatory_actions` |

Bootstrap placeholders are **forbidden**. Empty `mandatory_actions` under green is a real state (HOLD), not a stub.

## Fallback order (`loadHandoff`)

1. **KV** `handoff_latest`  
2. **GitHub JSON** `HANDOFF_JSON_URL` / `ops/HANDOFF-LATEST.json`  
3. **GitHub MD** JSON fence inside `HANDOFF-LATEST.md` (yaml fence legacy only)  
4. **null** → `next_actions` from live critical/warn only (no invented P3)

## Daily workflow

| When | Actor | Must write/read |
|------|--------|-----------------|
| 23:00 Lisbon | Night Diagnostic | Probe → write JSON+MD to GitHub → `POST /handoff` |
| Hourly | AIOps cron | Cycle agents; expose `/actions` |
| 09:00 Lisbon | Dev Cycle | `GET /actions` then JSON handoff → ≤2 ships or HOLD → optional `POST /handoff` clearing done items |

## Endpoints (stable)

```
GET  https://aiops.calhegasmorais.pt/health
GET  https://aiops.calhegasmorais.pt/cycle
GET  https://aiops.calhegasmorais.pt/actions
GET  https://aiops.calhegasmorais.pt/handoff
GET  https://aiops.calhegasmorais.pt/handoff/latest  (alias of GET /handoff; same JSON)
POST https://aiops.calhegasmorais.pt/handoff
POST https://aiops.calhegasmorais.pt/chat

# Orchestrator consume (read-only JSON; not 09:00 fulfillment; torch HOLD)
GET  https://calhegasmorais.pt/api/orchestrator/actions
GET  https://calhegasmorais.pt/api/orchestrator/handoff
GET  https://calhegasmorais.pt/api/orchestrator/handoff/latest
```

## `stratamesh.handoff.v1` (required fields)

```json
{
  "schema": "stratamesh.handoff.v1",
  "generated_at": "ISO-8601Z",
  "headline": "Green|Yellow|Red — …",
  "posture": "green|yellow|red",
  "status": { "version": "", "phase": "", "lab": true },
  "aiops": { "critical": 0, "warn": 0, "info": 0 },
  "mandatory_actions": [],
  "optional_actions": [],
  "non_actions": [],
  "notes": ""
}
```

Each action object when present: `id`, `priority` (P0|P1|P2), `owner`, `verb`, `success_check`, `effort` (S|M|L).

## Efficacy rules

- Green + mandatory empty ⇒ HOLD is success  
- Never mass-comment issues as work  
- Status pulse uses full `/` not thin `/health` only  
- Orchestrator chat consumes cycle + handoff + delegation_rule  
- Orchestrator `GET /actions` / `GET /handoff` are **read-only consume** of AIOps. They do not ship, do not pass the torch, do not add crons, and do not stand in for the 09:00 Dev Cycle. grok@ is not an SCA.


## Related

- [OPS-24H-DEV-CRON.md](./OPS-24H-DEV-CRON.md)  
- [OPS-EMAIL-AGENT-SOP.md](./OPS-EMAIL-AGENT-SOP.md)  
