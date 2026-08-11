# Associative vs Corporate DAOs (refined)

## Core distinction

| | **Associative** | **Corporate** |
|--|-----------------|---------------|
| Nature | **Non-commercial** | **Commercial** |
| Members | Users and/or **ACBs** (ACB-only, users-only, or **mixed**) | **Sócios** — unipersonal or multi-partner |
| Quotas | **Always equal** | **Proportional** to capital social (STRATA) |
| Voting weight | Always **1** | From **share_pct** / capital_strata |
| Profit in STRATA | **Forbidden** | **Allowed** — proportional payout from treasury |
| Capital social | N/A | Linked to **external official commercial registry** |

## Rules enforced in code
1. Associative `join` rejects `capital_strata`, `share_pct`, or `role: partner`.
2. Associative `distribute` / treasury dividend flags → `associative_no_profit_distribution`.
3. Associative proposals mentioning profit/dividend → rejected.
4. Corporate votes ignore client-supplied weight; weight = capital share.
5. Corporate partners: `POST /dao/partner` with `registry_ref` + `registry_jurisdiction`.

## CMN instances
- **DAO-CMN-ASSOCIATIVE** — mixed ACBs + FOG + operator; equal quotas
- **DAO-CMN-CORPORATE** — FOG unipersonal partner; registry `PT-CMN-UNIPERSONAL-PENDING`

## API
- `POST /dao/create` `{ kind: "associative"|"corporate" }`
- `POST /dao/join` · `POST /dao/partner` · `GET /dao/partners`
- `POST /dao/distribute` (corporate only)
- `GET /dao/info?dao_id=` → includes `rules`
