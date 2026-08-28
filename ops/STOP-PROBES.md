# Controlled burn · INC-1027

Nothing stays paused across 00:00 UTC. Vendor remaining is 0 until refill; hourly cap after refill is **100 000 / 24 ≈ 4 167**. Automations are **armed**. Worker HTTP is deferred until refill, then remaining ÷ hours.

## Apex

Fail-open catch-alls exposed origin PHP `SYSTEM LOGIN` (black / #0f0 Courier). Public `/` is now **Cloudflare Pages** (`calhegasmorais-pt`) — the Calhegas Morais landing, **zero Worker quota**. Origin PHP is `origin.calhegasmorais.pt`. SPA catch-alls `calhegasmorais.pt/*` removed; dashboard/tempo/chat/roadmap stay on SPA.

## Armed (not paused)

| Surface | Across refill |
|---|---|
| Grok automations ×4 | **Enabled.** Before 00:00 UTC: no Worker HTTP. After: cheap `/health`, never `workers.dev`, never `/actions` |
| Local ops-watchdog | `STASIS_UNTIL=2026-08-29T00:00:00Z` then metabolic interval. `monitor-start` does not refuse |
| DeoMail `workers.dev` | Stays **disabled**. Custom host behind 5/10s |
| Zone WAF | 5 req / 10s / IP / colo |
| Crons | Still **5/5**. No 6th. No plan upgrade |

Fog 530 remains P1. Mesh n=1. `spa.source=lab_seed`. Challenge 0 unfunded.
