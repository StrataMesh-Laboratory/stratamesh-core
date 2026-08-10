# SPA opt-out (lab)

Whitepaper contingency: providers may opt out under SPA terms.

```bash
POST /spa/opt-out
{"spa_id": "spa_…", "reason": "maintenance"}
```

Lab behaviour: marks SPA inactive immediately; `opt_out_days` retained for future grace-period enforcement.
