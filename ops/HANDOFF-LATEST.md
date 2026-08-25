# OPS Handoff — latest

> Written operationally from live probes. Consumed by AIOps + 09:00 Dev Cycle.

```json
{
  "schema": "stratamesh.handoff.v1",
  "generated_at": "2026-08-25T23:24:26Z",
  "headline": "Green \u2014 status 0.3.9-pulse phase 2 operational; AIOps 0 critical / 0 warn",
  "posture": "green",
  "status": {
    "url": "https://status.calhegasmorais.pt/",
    "version": "0.3.9-pulse",
    "phase": "2",
    "phase_name": "Nodal Hierarchy & SPAs",
    "lab": true,
    "node_status": "operational"
  },
  "aiops": {
    "url": "https://aiops.calhegasmorais.pt/cycle",
    "version": "1.7.0-handoff-loop",
    "critical": 0,
    "warn": 0,
    "info": 5,
    "top_signal": null
  },
  "mandatory_actions": [],
  "optional_actions": [],
  "non_actions": [
    "mass-comment GitHub issues",
    "second full diagnostic at 09:00",
    "invent P3 whitepaper work when green"
  ],
  "notes": "Operational handoff from live probes. Empty mandatory is intentional under green posture.",
  "fallbacks": {
    "primary": "https://raw.githubusercontent.com/StrataMesh-Laboratory/stratamesh-core/main/ops/HANDOFF-LATEST.json",
    "secondary": "https://aiops.calhegasmorais.pt/handoff",
    "tertiary": "https://aiops.calhegasmorais.pt/actions"
  }
}
```

## Human summary
**Green — status 0.3.9-pulse phase 2 operational; AIOps 0 critical / 0 warn**

- Status: `0.3.9-pulse` phase `2` (Nodal Hierarchy & SPAs)
- AIOps: 0 critical / 0 warn / 5 info
- Mandatory actions: **0** (HOLD is correct)
- Machine file: [HANDOFF-LATEST.json](./HANDOFF-LATEST.json)
