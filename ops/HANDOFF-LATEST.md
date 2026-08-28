# HANDOFF-LATEST — Night Diagnostic FOG-NODE-PT-CM-001

**generated_at:** 2026-08-28T22:09:20Z  
**lisbon:** 2026-08-28T23:09:20+0100  
**agent:** grok@calhegasmorais.pt  
**node:** FOG-NODE-PT-CM-001  
**phase:** night_diagnostic_23_lisbon · RESERVED METABOLIC PEAK

## Metabolism

| Item | Value |
|------|-------|
| grok-auto | 4 slots (armed, not paused) |
| cf-cron | 5/5 |
| Pages apex | yes (not PHP login) |
| STASIS_UNTIL | 2026-08-29T00:00:00Z |
| hourly_cap_after_refill | ≈4167 |
| formula | remaining / hours_until_renewal |
| 6th cron | **never** |
| plan upgrade | **no** |
| workers.dev | **never** |
| /actions | **never** |

Armed across UTC refill. Controlled burn. Vendor remaining = 0 until midnight UTC.

## Probes (pre-refill)

- **Apex** `https://calhegasmorais.pt/` → 200 · Cloudflare Pages landing
- **DeoMail skim** (API key, not workers.dev) → maintenance HTML on custom host; skim deferred
- **Fog** → 530 = **P1** (named tunnel; lab twin cannot SIGKILL)
- **Worker HTTP** → ZERO until refill

## Mesh / Fund

- n=1 · lab_seed · spa_source=lab_seed
- Challenge 0 **unfunded**
- Identity ≠ cargo
- WhatsApp is not briefing

## After refill (00:00 UTC)

1. Cheap multiplex `/health`: status, fog, aiops `/health`+`/handoff`, edge, api-edge, gossip/peers, fund `/api/v1/health`
2. Then POST aiops/handoff
3. Fund `budget_hint` must **not** be a bare integer

## Efficacy

**EFFICACY_SELF_SCORE:** 0.82

Lab honest. PT ok. No ships until refill.
