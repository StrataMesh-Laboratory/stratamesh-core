# Track B3 — ACB resource meters

## Behaviour
When `POST /acb/heartbeat` omits `consume` (default `auto_meter: true`):
1. Sample process CPU / RSS (`psutil` or `/proc`)
2. Map to PoSbs consume units via `estimate_consume`
3. Tick subsistence → may transition ACB state

## API
```json
POST /acb/heartbeat
{ "acb_id": "...", "earn": 0.1, "auto_meter": true }
// or manual:
{ "acb_id": "...", "consume": 1.5, "auto_meter": false }
```

Response includes `meter: { cpu_percent, mem_rss_mb, source, consume_est }`.
