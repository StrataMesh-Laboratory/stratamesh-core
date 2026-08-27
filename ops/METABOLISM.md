# Metabolic stasis

The lab was burning the day's quota before the day's reserved work.

## RCA (26–27 Aug 2026)

| Rail | Symptom | Cause | Fix |
|---|---|---|---|
| Grok automations | Discourse 18:00 `USAGE_POOL_EXHAUSTED` two days running | Watchdog hourly 00:00–08:00 Lisbon = **8 fires/night**, plus 09:00 + desk | Watchdog **daily 04:00** Lisbon. 4 budgeted slots + 2 desk. Peaks reserved. |
| AIOps `GET /actions` | 5–8s timeout | Live 1.10.3 hangs | Forbidden. Use `/health` + `/handoff`. |
| Status pulse | 4.0s | Full inventory vs `/health` 0.09s | Probes use `/health`. |
| Fog `530` / CF 1033 | Looks like mesh-down | Named tunnel origin down | P1 tunnel, not P0, unless status worker is also down. |
| CF ACB cron | 96 invocations/day (`*/15`) | Unpaced vs Free 5-cron / 100k req | **`30 * * * *`** (hourly, :30). Still 5/5 crons. |
| CF PoC + DAO | Fired together `0 */6` | Burst | PoC **`15 */6 * * *`**. Cap still 5. |
| ops-monitor | `INTERVAL_SEC=120` → hanging `/actions` | Local + AIOps stall | `/health`, 300s day / 900s night. |
| GitHub core | 5000/h | Not the bottleneck | Still paced: `remaining / hours_until_reset`. |
| DeoMail | No published limit | Mailbox skim could dump | 240/day, 10/h average. |

Silence is not stable. `ORCH-SILENCE` still escalates via grok@. This is **pacing**, not sleeping.

## Formula

```
hours_left  = max(seconds_until_renewal / 3600, 1/60)
hourly_cap  = remaining / hours_left
spendable   = remaining - reserved_future_peaks
```

- **STASIS** — remaining ≤ 0. Six-line note. No retry-loop.
- **HOLD** — unscheduled spend would steal a reserved peak still ahead, **or** cost > hourly_cap on a rate rail.
- **ALLOW** — budgeted slot / reserved peak with remaining ≥ cost, or unscheduled within contingency.
- **P0_BORROW** — P0 may spend; still no retry-loop on `USAGE_POOL_EXHAUSTED`.

Reserved Lisbon peaks (must survive until they fire):

1. 09:00 Dev Cycle
2. 18:00 Discourse pulse (the casualty)
3. 23:00 Night Diagnostic

Budgeted non-peak: 04:00 Watchdog (once).

Grok pool is shared with desk conversations. Daily automation budget = **6 fires** (4 slots + 2 contingency). Do not `run_now` the four automations to "test" them.

## Cloudflare Free

Still **5/5 crons**. No sixth.

| Worker | Cron (UTC) | Was |
|---|---|---|
| stratamesh-acb | `30 * * * *` | `*/15 * * * *` |
| stratamesh-aiops | `0 * * * *` | same |
| stratamesh-briefing | `0 10 * * *` | same |
| stratamesh-dao | `0 */6 * * *` | same |
| stratamesh-poc | `15 */6 * * *` | `0 */6 * * *` |

Metabolism is a **request-time library**, not a Worker cron.

## Code

- `lib/metabolism.py` — Node / lab watchdog
- `lib/metabolism.js` — Workers + dashboard
- `config/rails.json` — rail table
- `bin/ops-watchdog` — uses `/health`, metabolic interval, Fog 530 = P1

Lab honest. Identity ≠ cargo. AIOps is a team, not a cargo. No mainnet. Challenge 0 unfunded.
