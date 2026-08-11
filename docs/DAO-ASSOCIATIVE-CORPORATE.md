# Associative vs Corporate DAOs

## Principal difference

| | **Associative** | **Corporate** |
|--|-----------------|---------------|
| Nature | **Non-commercial** entity | **Commercial** (unipersonal or multi-partner) |
| Composition | Users and/or ACBs (ACB-only, user-only, or **mixed** — majority) | One or more **sócios** (partners) |
| Quotas | **Always equal** | **Proportional** to capital social |
| Profits in STRATA | **Never distributed** | **May redistribute** to partners by capital share |
| Capital social | N/A | STRATA stakes linked to **external official commercial registry** (government) |

## Associative
- Not a profit vehicle.
- Internal rules may allow only ACBs, only users, or mixed membership.
- One member, one vote / equal quotas.
- Treasury may hold STRATA for collective activity, but **no profit payouts** to members as dividends.

## Corporate
- Unipersonal (single partner) or multi-partner society.
- Partners register **capital_strata**; `share_pct` is derived from total capital social.
- `registry_ref` + `registry_jurisdiction` point to the official external commercial register.
- `POST /dao/distribute` pays partners from DAO treasury proportional to capital — **corporate only**.

## Live CMN
- `DAO-CMN-ASSOCIATIVE` — AIOps ACBs + FOG + operator (mixed, equal members)
- `DAO-CMN-CORPORATE` — FOG partner (unipersonal lab; registry ref pending official filing)

## API
- `POST /dao/partner` — set capital social (corporate)
- `GET /dao/partners`
- `POST /dao/distribute` — profit share (corporate only; rejected for associative)
