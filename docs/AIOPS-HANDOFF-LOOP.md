# AIOps handoff loop (Worker 1.7+)

**Worker:** `stratamesh-aiops` · **Version:** `1.7.0-handoff-loop` · **Cron:** hourly `0 * * * *`

## Role in the daily system

```
Night Diagnostic (23:00)
  → writes ops/HANDOFF-LATEST.md
  → POST https://aiops.calhegasmorais.pt/handoff
        ↓
AIOps hourly cycle (Workers)
  → probes STATUS full pulse + AUTH/ORCH/IOT
  → agents: devops · security · analysis · mesh · economy
  → next_actions = handoff.mandatory ∪ live critical/warn only
  → empty next_actions when green is VALID
        ↓
GET /actions  ← Orchestrator + morning Dev Cycle
        ↓
Dev Cycle (09:00) executes ≤2 or HOLD
  → optional POST handoff with mandatory cleared
```

## Endpoints

| Path | Use |
|------|-----|
| `GET /` `GET /cycle` | Full budgeted team cycle |
| `GET /actions` `GET /delegate` | Delegation surface (next_actions + handoff) |
| `GET/POST /handoff` | Read / push `stratamesh.handoff.v1` |
| `GET /health` | Worker health + version |
| `POST /chat` | Orchestrator-assisted chat with cycle+handoff context |

## Fixes in 1.7.0

- Probe **full status pulse** (`/`) not only thin `/health` → correct phase + version (0.3.9)
- Removed perpetual priority-3 whitepaper spam in `next_actions`
- Handoff from GitHub raw + optional KV
- Orchestrator chat uses budgeted cycle + handoff + delegation_rule

## Lab constraints

Free plan · pre-testnet · Subjects ≠ objects · no mainnet claims.
