# Per-account #mint / #0 lifecycle (on-graph)

Each **registered** user/SCA on this Fog Node is a graph subject with its own wallet (`sm:u:…`). Anonymous visitors have no dashboard and no wallet.

```
open (ACCOUNT tx, amount 0)  — not a mint
PoC  #mint → wallet         — MINT tx, only contribution
PAYG wallet → #0            — BURN tx, subsistence
hire wallet → wallet        — TRADE tx, not a mint
```

Fog `NODE_WALLET` is treasury, not a citizen. `#mint` never receives. `#0` never spends.

| Layer | Store |
|---|---|
| Fog process | `AccountGraph` + DAG (`TxType.ACCOUNT/MINT/BURN/TRADE`), replayed from cid |
| Auth | `users.token_balance` / `minted_poc` / `burned_pos` + `account_events` |
| Token D1 | `account_graph` + `lifecycle_events` + `token_balances` |

HTTP: Fog `GET /account/lifecycle` `POST /account/open` (local PoC mint). Auth `GET /lifecycle` `POST /payg/tick` `POST /lifecycle/transfer`. Token `GET /lifecycle?account=` `POST /account/open`.

Dashboard (registered-only) shows minted from `#mint`, burned to `#0`, circulating, events, NFTs.
