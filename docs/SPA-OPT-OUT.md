# SPA opt-out (lab)

```bash
POST /spa/opt-out
{"spa_id": "spa_…", "reason": "maintenance"}
# immediate (skip grace):
{"spa_id": "spa_…", "reason": "emergency", "immediate": true}
```

## Grace period (lab clock)
- `opt_out_days` on the SPA → **lab seconds** = `days * 60` (accelerated)
- Status `opt_out_pending` while still **active** during grace
- `GET /status` runs `apply_opt_out_grace()` and deactivates when elapsed
- Production would use `days * 86400` wall time

## Temporary ops
Public pulse may be refreshed from Grok session or MacBook via status Worker ingest until Oracle Free is available.
