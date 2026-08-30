# Registered-user PAYG subsistence

Citizen accounts on this Fog Node pay for **resource-using** services from their STRATA wallet. Burn goes to `#0`. This is **not a mint**. Hire remains transfer.

| Who | Dashboard | Resource actions | Static NFT |
|---|---|---|---|
| Anonymous | **none** (login/register gate) | none | none on dashboard |
| Registered, balance ≥ 0.1 + rate | live PAYG | burn to `#0` | yes |
| Registered, below floor 0.1 | instantiated, **static** | locked | yes |

Fog `NODE_WALLET` / `#mint` / `#0` are not citizen rails.

Rates (lab): `src/subsistence/user_payg.py` `BURN_RATES` — dashboard tick 0.001 / 15s, orch chat 0.02, sandbox 0.04, VA 0.03, spa execute 0.05, NFT mint 0.10. `nft_list` / `nft_view` / ontology / health = 0.

HTTP:

- Auth `GET /api/auth/me` includes `subsistence`
- Auth `GET /api/auth/subsistence`
- Auth `POST /api/auth/payg/tick` `{action}` → 401 anonymous, 402 static, 200 live burn
- Fog `GET /payg/rates` `POST /account/spend`
- Apex `/dashboard` requires session cookie/`sm_token`
