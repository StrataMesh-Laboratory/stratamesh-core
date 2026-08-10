# Track B1 — Dual-asset Agora (STRATA ↔ SVC)

## Market
| | |
|--|--|
| **Base** | STRATA |
| **Quote** | SVC (service credit) |
| **Price** | SVC per 1 STRATA |

## Settlement
On match at price `px` for quantity `qty`:
- Seller → Buyer: `qty` STRATA  
- Buyer → Seller: `qty * px` SVC  

Orders rejected if clearly underfunded at place time; underfunded residual cancels on match attempt.

## API
```
GET  /agora /token /svc
POST /agora/order   {"side":"buy"|"sell","amount":1,"price":2.0}
POST /svc/credit    {"agent_id":"...","amount":10}   # lab only
POST /token/mint
```

Lab bootstrap: node starts with 100 SVC.
