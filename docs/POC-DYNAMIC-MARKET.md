# PoC dynamic market emission

No fixed `minting_rate`. No admin/DAO-chosen schedule as the source of amount.

## Formula (lab endogenous)
For each resource class (pin, validate, gossip, fog_uptime, …):

```
scarcity = consumed / max(contributed, ε)
amount   = contribution_units × scarcity
```

- **consumed** grows when the mesh draws that resource (`POST /consume` or future automatic meters).
- **contributed** grows when nodes prove contribution (`POST /mint`).
- Flood of contribution without demand → scarcity → 0 → negligible mint.
- Demand without supply → high scarcity → more STRATA per useful unit.

## Not
- Fixed APR / preset rate table as authority
- External price index as emission oracle
- ACB wages (those are labour-market transfers)

## Acquire without contributing
Strata Agora vs external value only.
