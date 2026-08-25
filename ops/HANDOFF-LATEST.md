# OPS Handoff

```json
{
  "schema": "stratamesh.handoff.v1",
  "generated_at": "2026-08-25T23:37:56Z",
  "headline": "Green \u2014 mesh count 2: FOG-NODE-PT-CM-001 + live EDGE-GROK-CMN-001",
  "posture": "green",
  "status": {
    "version": "0.3.9-pulse",
    "phase": "2",
    "lab": true
  },
  "aiops": {
    "critical": 0,
    "warn": 0,
    "info": 5
  },
  "mandatory_actions": [],
  "optional_actions": [],
  "non_actions": [
    "list edge without /health 200",
    "claim physical FOG capacity for EDGE-GROK"
  ],
  "notes": "Edge: https://edge.calhegasmorais.pt/ \u2014 see docs/EDGE-GROK-NODE.md",
  "mesh": {
    "fog": "FOG-NODE-PT-CM-001",
    "edge": "EDGE-GROK-CMN-001",
    "gossip": "lab_fog_plus_live_edge"
  }
}
```
