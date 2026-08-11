# AIOps Dev Team — continuous node development

Whitepaper-aligned: AIOps are **essential**, not cosmetic health checks.  
They operate under the **Hybrid Orchestrator** (federated meta-learning + QIGA, substrate-neutral ontology) to **develop and operate** the Calhegas Morais Fog Node on an ongoing basis.

## Mandate

| Agent | Role | Continuous work |
|-------|------|-----------------|
| **devops** | Runtime & deploy | Fog process, publish_loop, Worker deploys, temp→always-on migration |
| **security** | Auth & exposure | Sessions, tokens, WAF/domain posture |
| **analysis** | Metrics & anomalies | DAG growth, status pulse, phase tracking |
| **mesh** | Network topology | SPA roles, gossip readiness, tip/finality signals |
| **economy** | Token & Agora | PoC mint bounds, settlement integrity, emission policy |

Standing is by **function and agreement**, not substrate (see `EPISTEMIC-ONTOLOGY.md`).

## Worker

- Script: `stratamesh-aiops`
- Endpoints:
  - `GET /health` — liveness + team roster
  - `GET /team` — agent mandates
  - `GET /cycle` or `/run` — **full development cycle** (probes status, orchestrator, auth; emits findings + next_actions)
  - `GET /last` — last persisted cycle (KV) or live cycle
  - `GET /` — service summary + latest cycle
- **Cron**: scheduled handler runs `runTeamCycle` (configure Cron Trigger in Cloudflare, e.g. `*/15 * * * *`)

## Relation to Orchestrator

1. Orchestrator (`src/orchestrator/`) — bilateral bus, QIGA, symbolic constraints (lab Python).  
2. AIOps Worker — edge-side **continuous ops loop** against live Workers/status.  
3. Human operator (André Manuel Calhegas Morais) — escalations, host migration, irreversible policy.

## Not done by health shims

Portal diagnostics previously used SPA **shims** that returned `"ok"` without running the team cycle.  
Prefer:

```bash
curl -s https://stratamesh-aiops.stratamesh.workers.dev/cycle | jq .
```

## Next (roadmap)

- Wire cycle output into status Worker (`aiops` block)
- Cron every 15 minutes in production account
- Agent-specific auto-tasks (open GitHub issues, mesh_doctor remote trigger) when host is always-on

## Continuous vs interval

| Mode | Where | Continuity |
|------|--------|------------|
| **Host loop** | MacBook / Oracle / Fog box | **True continuous** — `scripts/aiops_continuous_loop.sh` (default every 30s) |
| **Cron Trigger** | Cloudflare Worker | Near-continuous — minimum typically **every 1 minute** (`* * * * *`). Not an infinite loop inside one request. |
| **On-demand** | `GET /cycle` | Manual or portal Diagnostics |

Cloudflare Workers **must not** run `while (true)` inside `fetch`/`scheduled` (CPU/time limits).  
Whitepaper “24/7 development” is satisfied by:

1. Always-on Fog host + **aiops_continuous_loop.sh** + **publish_loop.sh**
2. Optional CF cron every minute as edge complement

```bash
# True continuous (on the node host)
export AIOPS_INTERVAL_SEC=30
./scripts/aiops_continuous_loop.sh
```
