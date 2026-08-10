# Phase 6 Scaffold — ACBs + Proof of Subsistence

## ACB lifecycle
`register` → heartbeats (consume/earn) → PoSbs tick → state:
active | hibernating | migrating | evolving | exited

## API
```
GET  /acb
POST /acb/register   {label, capabilities?}
POST /acb/heartbeat  {acb_id, consume?, earn?}
```

Registration anchors a DAG tx. Heartbeats drive subsistence pressure and optional PoC credit on earn.
