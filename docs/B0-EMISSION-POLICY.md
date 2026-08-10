# Track B0 — STRATA emission policy (lab)

**Scope:** Lab / testnet only. Not a securities offering. Not mainnet.

## Principles
1. **Contribution first** — STRATA is minted only from recorded Proof of Contribution credits.
2. **1:1 lab rate** — default `mint_from_poc(..., rate=1.0)` until governance changes it.
3. **No free mint** — `POST /token/mint` converts unminted PoC balance only (delta vs current STRATA).
4. **On-graph** — each mint attaches a `TxType.MINT` DAG transaction.
5. **Auditability** — balances and mint events are queryable via `/contribution` and `/token`.

## PoC credit sources (current lab weights)
| Action | Typical units | Notes |
|--------|---------------|--------|
| validation / submit | 1.0 | per accepted tx path |
| gossip | 0.2 | per successful gossip reply batch |
| spa_uptime | 5.0 | on SPA register |
| pin / acb_work | variable | when wired |

Exact weights live in call sites (`node_persistent`, `acb`) and may be adjusted by DAO proposal later.

## Caps (lab recommendations)
| Cap | Lab default | Rationale |
|-----|-------------|-----------|
| Per-mint rate | 1.0 STRATA / PoC unit | Simple audit |
| Daily mint per agent | *none enforced* | Add soft cap in B1 |
| Total supply | *unbounded lab* | Policy freeze before public testnet economics |

## Agora interaction
- Sells require STRATA balance ≥ order size (settlement).
- Trades attach `TxType.TRADE` on-graph.
- Dual-asset markets (STRATA ↔ service credit) deferred to **B1**.

## Audit procedure
```bash
cd src
python3 emission_audit.py --db /path/to/fog.db
# or against running node:
python3 emission_audit.py --url http://127.0.0.1:8787
```

Exit criteria for B0: this document + reproducible audit script matching `/token` and `/contribution`.
