# Cloudflare Free-tier request budget (100k / day)

## What was burning quota
| Source | Before | After |
|--------|--------|-------|
| `stratamesh-aiops` cron | `* * * * *` (+ full ACB fan-out) | `0 * * * *` **light** (~2 probes) |
| `stratamesh-orchestrator` cron | `* * * * *` (no handler = waste) | **disabled** |
| `stratamesh-poc` cron | hourly | every **6h** |
| `stratamesh-dao` cron | hourly | every **6h** |

## Daily cron budget (approx)
- AIOps light: 24 inv/day × ~2–3 subreqs ≈ **50–70**
- PoC + DAO: 4 + 4 = **8**
- Manual portal / chat / mint: variable — keep light

## Practices
1. Do **not** run external loops hitting Workers every second.
2. Prefer **service bindings** over public `fetch` where possible (still counts; avoid chatter).
3. Portal Economy: **5 min session cache**; Refresh only when needed.
4. DAG gossip only on real submits (not on timers).
5. Full ACB ops-cycle: **on demand** `POST /acb/team/ops-cycle` or `/team-pulse`, not cron.

## If limit hits before UTC midnight
Workers may 429 until reset. Wait for reset; avoid hammering health endpoints.
