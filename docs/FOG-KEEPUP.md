# Fog keep-up stream — quantity × quality (lab)

Mac Fog plugins in `src/fog_plugins/`:

| Plugin | Role |
|--------|------|
| `ping` | Hop ping (`workerd :8788`). Fog is in-process (no self-HTTP). Public origin opt-in. `workers.dev` refused. |
| `keepup` | Quantity × quality sample every 15s. Unready does not contribute. |
| `rails` | Plug to PoC → `#mint` and PoS → `#0`. **Unarmed** while `oracle_live=false`. |

## Score

```
quantity  = 0.35·ok_ratio + 0.25·uptime + 0.20·residual(1−CPU) + 0.20·rtt
quality   = √(honesty × fail_closed × continuity × (0.5 + 0.5·hop_ok))
score     = quantity × quality     # not additive
```

Honesty fails if `n=2` and `f_max≠0`, or a ping URL contains `workers.dev`. Empty/failed workerd ping is unready → score 0.

## HTTP (Fog :8787)

- `GET /ping`
- `GET /contribution/metrics`  (`/keepup`)
- `GET /contribution/stream?n=20`
- `POST /contribution/tick`  loopback only

JSONL: `$FOG_DATA/keepup.jsonl` schema `stratamesh.fog.keepup.v1`.

## STRATA rails (later)

`FOG_MINT_ARMED=1` and `oracle_live` would copy keep-up score into `ContributionLedger` then `mint_from_poc` (`#mint`). `FOG_BURN_ARMED=1` would burn quality-collapse to `#0`. Hire remains transfer, never mint. Lab default: measure only.

TUI shows `keep-up Q K S` and `rails mint_armed=false`.
