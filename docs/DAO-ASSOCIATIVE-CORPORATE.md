# Associative vs Corporate DAOs (live)

## Kinds
| Kind | Vote | Membership | Treasury | Clearance |
|------|------|------------|----------|-----------|
| **Associative** | one member, one vote | open join | collective, high bar for payout | soft |
| **Corporate** | role / weight | invite + clearance | admin-controlled | RBAC gates |

Templates also: `foundational` → associative alias; `enterprise` → corporate alias; `consortium`.

## CMN instances
- `DAO-CMN-ASSOCIATIVE` — AIOps team + community members (realm-linked)
- `DAO-CMN-CORPORATE` — node ops, FOG admin, treasury account `treasury:DAO-CMN-CORPORATE`

## API
- `POST /dao/bootstrap` — create CMN pair
- `POST /dao/create` `{ kind, name }`
- `POST /dao/join` `{ dao_id, member_id }`
- `GET /dao/list` · `GET /dao/info?dao_id=` · `GET /dao/members?dao_id=`
- `POST /dao/treasury` `{ dao_id, action: deposit|payout, amount }`
- `GET /dao/templates`
- Proposals/votes/execute remain clearance-gated on the same worker

## Economics
Treasury moves are **STRATA transfers** (no mint). Funding comes from PoC/Agora/labour, not faucets.
