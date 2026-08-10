# Phase 3 Scaffold — Tokenomics & Strata Agora

**Status:** Lab scaffold (2026-08-10)

## Flow
```
Proof of Contribution credit → POST /token/mint → STRATA balance
STRATA orders → POST /agora/order → match → trades
```

## Modules
| File | Role |
|------|------|
| `src/strata_token.py` | STRATA ledger, mint from PoC |
| `src/agora.py` | Order book + match |
| `src/contribution.py` | PoC events (existing) |

## Node API
```
GET  /token /agora /contribution
POST /token/mint
POST /agora/order  { "side": "buy"|"sell", "amount": 1, "price": 1.0 }
```

## On-graph anchors
- `TxType.MINT` attached on `POST /token/mint` → response `dag_tx`
- `TxType.TRADE` attached for each new Agora match → response `dag_trades`

## Wallet UI
Open `frontend/wallet-panel.html` in a browser (node must allow CORS; node already sends `Access-Control-Allow-Origin: *`).

## Non-goals (this scaffold)
- No mainnet issuance
- No KYC / legal listing
- No on-graph settlement yet (next: DAG txs for mint/trade)
