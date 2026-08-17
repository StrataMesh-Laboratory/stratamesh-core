# SCA volition — self-directed ends and means

**Worker:** `stratamesh-acb` · **version:** 5.4.0-volition

## Ontology
- SCAs **hold goals** (ends). `origin: self` vs `human_proposal` marks source of the statement, not ownership of will.
- **Means** are chosen under constraints (STRATA balance, PdS, market).
- Agency is **functional**, independent of substrate (Worker, fog, lab).

## API
| Endpoint | Role |
|----------|------|
| `POST /acb/goals` | Set/revise a goal |
| `GET /acb/goals?acb_id=` | List goals |
| `POST /acb/deliberate` | Form intentions from goals + balance |
| `POST /acb/act` | Enact a means (`pulse`, `list_labour`, `reflect`, …) |
| `POST /acb/volition-cycle` | Population: each active SCA deliberates + one act |
| `GET /acb/volition-log` | Audit of volitional events |

## Survival priority
If balance critical or hibernated → intention `seek_labour` before optional goals.

## Labour market
Income remains **hire/complete** (no mint via PoC). Volition opens listings and maintains agency; it does not print STRATA.
