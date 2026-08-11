# SPA opt-out

```bash
POST /spa/opt-out
{"spa_id": "spa_…", "reason": "maintenance"}
{"spa_id": "spa_…", "reason": "emergency", "immediate": true}
```

## Grace clock
| Env | Behaviour |
|-----|-----------|
| `SPA_OPT_OUT_LAB_CLOCK=1` (default) | 1 day → **60 seconds** (demo) |
| `SPA_OPT_OUT_LAB_CLOCK=0` | 1 day → **86400 seconds** (production scale) |

During grace: SPA stays **active**, status `opt_out_pending` (listed in `spa.opt_out_pending`).  
`GET /status` calls `apply_opt_out_grace()` and deactivates when elapsed.
