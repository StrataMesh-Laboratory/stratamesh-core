# Track B2 — Meta-finality modules

## Interface
`FinalityModule.evaluate(tx_id, dag, tip_report) → FinalityVerdict`

## Built-in modules
| Name | Behaviour |
|------|-----------|
| `probabilistic` | Tip confidence only; never claims finalized |
| `cw_threshold` | Finalized if cumulative_weight ≥ 3 and confidence ≥ 0.2 (lab defaults) |

## API
```
GET /finality           # tips + modules run
GET /finality/modules   # module verdicts only
```

DAO-certified modules can be registered later by extending `FinalityEngine.modules`.
