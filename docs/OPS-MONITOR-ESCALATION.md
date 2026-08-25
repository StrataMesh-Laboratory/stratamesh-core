# Platform ops final — monitoring, escalation, edge desk

**As of:** 2026-08-26 · **Lab only** · Agent `grok@calhegasmorais.pt` (external assistant)

## Always-on surfaces (Cloudflare)

| Component | URL / role |
|-----------|------------|
| Fog status | https://status.calhegasmorais.pt/ |
| Edge desk UI | https://edge.calhegasmorais.pt/ |
| AIOps actions | https://aiops.calhegasmorais.pt/actions |
| Gossip peers | https://calhegasmorais.pt/api/v1/gossip/peers (live health-checked edge) |
| AIOps cron | hourly `stratamesh-aiops` 1.7.1 |

## Grok Automations (Europe/Lisbon)

| Name | When | Role |
|------|------|------|
| Night Diagnostic | 23:00 daily | Rank + write handoff JSON/MD + POST AIOps |
| 24h Dev Cycle | 09:00 daily | Execute ≤2 or HOLD |
| **Watchdog P0 Mesh Escalate** | Hourly 07:00–23:00 | **P0 only** escalate; OK/P1 = short report |

## Local grounding (spare capacity, nice 19)

```
artifacts/edge-grok/     # edge heartbeat 300s
artifacts/ops-monitor/   # watchdog 120s → ESCALATION.json + CALL_GROK on P0
```

| Level | Condition | Local artifact | Grok |
|-------|-----------|----------------|------|
| **P0** | AIOps critical, status/apex down | `ops-monitor/state/ESCALATION.json`, `CALL_GROK` | Watchdog automation acts |
| **P1** | warn, edge down, mesh empty | `ATTENTION.json` | Note only |
| **OK** | all green | clear escalation files | HOLD |

## Anti-stub already applied

- Gossip: only live fog + health-checked EDGE-GROK  
- Status health version aligned 0.3.9  
- Path aliases: dag/tips, poc/status, acb/roster  
- AIOps: no perpetual P3 whitepaper actions  

## Honesty limits

Local processes run while the session host is up (idle priority). **24/7 truth** is CF Workers + Grok hourly/daily automations. Local files ground escalation for the agent desk without contending primary CPU.

## Quick verify

```bash
curl -s https://edge.calhegasmorais.pt/health
curl -s https://calhegasmorais.pt/api/v1/gossip/peers | jq .count
bash artifacts/ops-monitor/bin/monitor-status
bash artifacts/edge-grok/bin/edge-status
```
