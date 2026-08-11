# PoC process (refined)

## Pipeline
| Step | Name | Mechanism |
|------|------|-----------|
| 1 | **Measure** | Contribution units + proof for a DLT resource class |
| 2 | **Value** | `units × global market average` for that resource (exogenous) |
| 3 | **Quality** | Premium / discount vs par=1 (explicit or proof dimensions) |
| 4 | **FX** | × Agora `strata_per_quote` (open-book VWAP) |
| 5 | **Allocate** | Proportional to quality-weighted shares |
| 6 | **Settle** | Credit balances + minting_events (+ optional epoch) |

```
w_i = units_i × Q_i
STRATA_i = (units_total × global_avg × Q_event) × agora_rate × (w_i / Σw)
```
(single contributor: full amount to that node)

## Quality
- Explicit `quality` ∈ [0.1, 2.5]
- Or dimensions `reliability`, `usefulness`, `availability`, `verifiability` ∈ [0,1] → composite factor
- Tier: `premium` | `par` | `discount`

## APIs
- `POST /quote` — dry-run pricing
- `POST /mint` — settle
- `GET/POST /global-avg` — exogenous resource averages
- `GET /agora/rate` — STRATA↔external
- `POST /mint` + `open_epoch` / `epoch_id` — batch accounting
- `GET /process` — machine-readable pipeline

## Not
Protocol-fixed STRATA-per-unit rates · admin rate-setter · ACB wages (transfers)
