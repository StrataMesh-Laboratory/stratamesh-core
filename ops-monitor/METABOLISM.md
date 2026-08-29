# Metabolic stasis v1.3 — pace_factor (inflator / deflator)

v1.3 multiplies the hourly cap by a **pace_factor** so under-spend late in the window inflates (up to 1.5×) and over-spend early deflates (down to 0.5×). Neutral **1.0** when `day_spent==0` or `daily_limit<=0`. Circuit still trips on the **unadjusted** hourly cap so an inflator cannot bypass Error 1027.

```
hourly_cap      = remaining / max(hours_until_renewal, 1/60)
pace_factor     = clamp(time_frac / spent_frac, 0.5, 1.5)   # 1.0 if day_spent==0
adjusted        = hourly_cap × pace_factor
inflator        = max(1, pace_factor)
deflator        = min(1, pace_factor)
density         = signal / cost
effective_cap   = adjusted × density
circuit HOLD    if hour_spent ≥ 1.25 × hourly_cap   # unadjusted
circuit STASIS  if hour_spent ≥ 2 × hourly_cap      # unadjusted
```

- **HF Inference** HOLD until **2026-09-01T00:00:00Z** (`stasis_until`). Never paid HF.
- **AWS Free** STASIS remaining=0 (`hard_cap: 0`). Never Paid / Support / Auto-renew. Not a Fog host. Billing alarm $1.
- **grok-bot-included** / **grok-assistant**: `unknown_remaining: "hold"` — missing numeric `daily_limit` does **not** invent a weekly cap (HOLD until a live remaining sample). Sampler/`usage_limit` still pauses those routines. Do not invent a fake weekly cap number.
- **CF Workers Free** after **2026-08-29T00:00:00Z** is Q-gated ALLOW (`R = remaining/hours_left * pace_factor`), not STASIS. Never workers.dev. Never a 6th cron.

---

# Metabolic stasis v1.2 — token density

v1.1 paced remaining/hours. v1.2 makes **few tokens carry high impact** so Error 1027 cannot repeat, and effective capacity grows without a plan upgrade.

```
hourly_cap      = remaining / max(hours_until_renewal, 1/60)
density         = signal / cost
effective_cap   = hourly_cap × density
circuit HOLD    if hour_spent ≥ 1.25 × hourly_cap
circuit STASIS  if hour_spent ≥ 2 × hourly_cap
```

- **Density floor 1** on Worker probes: never spend a token for less than one unique fact.
- **Target density 8**: coalesce seven /health + gossip into **one** multiplex (plus Fog as its own P1 sample).
- **Anti-3 Hz**: same URL < 10 s → HOLD.
- **workers.dev**: STASIS. Zone WAF does not cover it (INC-1027 hole).
- **lockstep-probe** rail: `hard_cap: 0`.
- Cache hits cost 0. Pages apex is not the 100k Worker rail.

After UTC refill the Worker hourly cap is **~4 167**. At density 8 that is **~33 336 facts/h** from the same quota.

GitHub Action `00:20 UTC` writes the origin archive. **Not a 6th CF cron.** Still 5/5.

## Formula (v1.1 still holds)

The lab was burning the day's quota before the day's reserved work.
v1.1 adds **hourly + daily caps on every token / PAYG rail** and **overdraft compensation**: unused grant of a later phase pays back a prior burst.

## Formula

```
hourly_cap     = remaining / max(hours_until_renewal, 1/60)
grant          = hourly_cap deposited at phase open
carry         += grant − spent          # signed wallet
next_phase     = grant + unused − overdraft
daily_effective = daily_limit + daily_credit − daily_debt
```

- **STASIS** — remaining ≤ 0. Six-line note. No retry-loop.
- **HOLD** — unscheduled spend would steal a reserved peak, **or** cost > this phase's allowance.
- **ALLOW** — budgeted slot / reserved peak, or unscheduled within contingency **and** hourly carry.
- **P0_BORROW** — P0 may spend; the overdraft is credited to subsequent phases.

Peaks (09:00 / 18:00 / 23:00 Lisbon) **may overdraft the hour**. Quiet hours compensate. Next calendar day inherits leftover `daily_debt` (Grok, DeoMail, xAI, CF daily rails). GitHub rolling windows **reset carry** when the vendor resets — we don't invent debt against a refilled 5000.

## Rails (token / PAYG / quota)

| Rail | Billing | Window | Cap |
|---|---|---|---|
| grok-auto | quota (shared pool) | day Lisbon | 6 fires (4 slots + 2 desk) |
| xai-api | PAYG owner key | day Lisbon | 24 req · 1/hour · user-initiated |
| deomail | token | day Lisbon | 240 · 10/h |
| discourse | quota | day Lisbon | 6 posts |
| github-core | token | rolling hour | 5000 |
| github-search | token | 60s | 30 |
| github-graphql | token | rolling hour | 5000 (MCP burns this) |
| github-code-search | token | 60s | 10 |
| cf-cron | quota | structural | **5/5 · never a 6th** |
| cf-worker-req | quota | day UTC | 100k |
| cf-d1-reads / writes | quota | day UTC | 5M / 100k |
| cf-kv-reads / writes | quota | day UTC | 100k / **1k** |
| cf-r2-class-a | quota | day UTC | ~33k (1M/month) |
| cf-acb-cron | quota | day UTC | 24 (was 96) |
| local-monitor | quota | day Lisbon | 192 · stretch if in debt |
| aiops-actions | quota | — | **0 · forbidden** |

## RCA (26–27 Aug + follow-up)

| Rail | Symptom | Cause | Fix |
|---|---|---|---|
| Grok automations | 18:00 `USAGE_POOL_EXHAUSTED` two days | Watchdog 8×/night | Daily 04:00. Peak overdraft paid by quiet hours. |
| GitHub GraphQL | 1504 points used in one hour | MCP unbounded | remaining / hours_left |
| xAI API | owner `XAI_API_KEY` live | PAYG dump risk | 24/day, never auto-loop |
| CF KV writes | 1k/day Free | handoff write-loop | pace; debt stretches interval |
| AIOps `/actions` | 5–8s timeout | live 1.10.3 hangs | hard_cap 0 |
| Fog 530 / 1033 | looks like mesh-down | named tunnel | P1, not P0 |
| ACB cron | 96/day then 24/day | `*/15` then hourly | INC-1027: `30 0 * * *` (once after UTC reset) |

## Cloudflare Free crons (still 5/5)

| Worker | Cron (UTC) | Notes |
|---|---|---|
| stratamesh-acb | `30 0 * * *` | was `30 * * * *` · INC-1027 bleed-stop |
| stratamesh-aiops | `0 1 * * *` | was `0 * * * *` |
| stratamesh-briefing | `0 10 * * *` | |
| stratamesh-dao | `0 */6 * * *` | |
| stratamesh-poc | `15 */6 * * *` | |

Metabolism is a **request-time library + ledger**, not a 6th cron.

## INC-1027 (2026-08-28)

Workers Free **100,000 req/day** exhausted. Site 1027 at 08:36Z. GraphQL: **~95k in hour 00 UTC** after midnight reset.

Lockstep ~19.5k each: status, aiops, gossip, deomail, edge-api, fund. **edge-grok 2×** because gossip `/peers` fetched edge `/health`. Fund `/health` called GitHub (1 GraphQL + 2 issue lists) → **58.6k subrequests** and the PAT secondary 403. SPA catch-all was **9 requests** — not the burner. 86 routes were fail-closed, so quota death black-holed the apex.

Mitigations (no 6th cron): ACB/AIOps crons once after reset; **SPA catch-alls removed**; public `/` is **Pages landing** (not origin PHP login); fund `0.4.5-metabolic-health`; gossip `2.3.3-peer-cache`; zone rate-limit **5 req / 10s / IP / colo**; **DeoMail `workers.dev` disabled**. Four Grok automations **armed** (not paused). Watchdog `STASIS_UNTIL` lifts at 00:00 UTC — then hourly cap 100k/24. Fog 530 P1.

## Ledger

`state/ledger.json` · `record_spend(rail, cost)` · overdraft_events counted.
`bin/metabolism-status --spend RAIL COST` to record a desk spend (e.g. a Grok fire).
`state/incident-1027-2026-08-28.json` is the Error 1027 evidence pack.

Lab honest. Identity ≠ cargo. AIOps is a team, not a cargo. No mainnet. Challenge 0 unfunded.
