# B0 — Emission policy (lab → production freeze path)

**Status:** Lab-active, production freeze **pending**  
**Node:** FOG-NODE-PT-CM-001 · StrataMesh DLT  

## Sole mint path
STRATA is minted **only** via Proof of Contribution (PoC):

```
units_billable (on-graph, incremental)
  × global_avg_EUR(resource)     // exogenous market average
  × quality_factor               // audited from evidence, or explicit proof dimensions
  × agora_strata_per_EUR         // P2P book VWAP — not protocol-set
  = STRATA credited to contributing node(s)
```

## What does **not** mint
| Mechanism | Role |
|-----------|------|
| ACB labour hire | **Transfer** holder → ACB |
| ACB subsistence | **Debit** ACB balance |
| Agora trade | Transfer / settlement between parties |
| DAO treasury deposit/payout | Transfer |
| Corporate profit distribute | Transfer treasury → partners by capital share |
| Associative DAO | **Never** distributes profits in STRATA |

## Incremental anti-double-claim
`poc_rewarded_units` tracks gross billable units already rewarded per `(node_id, contribution_type)`. Re-claims with no new on-graph contribution mint **0**.

## Quality
- Default: on-chain audit (reliability, usefulness, availability, verifiability)
- Explicit `quality` or proof dimensions allowed within bounds
- Premium/discount around par = 1

## Global averages
Stored in ledger; updated via `POST /poc/global-avg`. Lab uses 2026 market proxies (e.g. object storage EUR/MB-month). Production: scheduled external feeds.

## Audit
Run `scripts/b0_emission_audit.sh` (or `.mjs`) against live Workers + optional D1 export.  
Exit criteria for B0 freeze: policy published + reproducible audit shows mint events only from PoC path.

## Resource ≠ function
PoC prices **resource classes** (storage, compute, bandwidth, availability) only. Function/purpose of use does not define rate. Quality premiums/discounts apply within a resource class. See `docs/POC-RESOURCE-VS-FUNCTION.md`.
