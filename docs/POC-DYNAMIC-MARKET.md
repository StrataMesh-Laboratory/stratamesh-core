# PoC pricing: global resource average → Agora → quality

## Chain
1. **Global market average** for the resource class contributed to the DLT  
   (mean of external markets for storage, validation compute, bandwidth, fog capacity, …).
2. **Value in STRATA** at the **Agora** P2P rate  
   (`STRATA = external_quote_value × agora.strata_per_quote`).
3. **Attribution** with variable **quality premium or discount**  
   (`factor = 1` par; `>1` premium; `<1` discount), proportional to the contributor’s share.

```
global_avg_value     = units × global_market_average_per_unit
value_after_quality  = global_avg_value × quality_factor
STRATA_minted        = value_after_quality × agora.strata_per_quote
```

## Sources
| Signal | Source |
|--------|--------|
| Resource average | Exogenous global markets (`GET/POST /poc/global-avg`) |
| STRATA↔external | Agora open book VWAP (`GET /agora/rate`) |
| Quality | Proof / measured contribution quality |

No protocol-fixed mint rate. Empty Agora book → no STRATA price → mint blocked.
