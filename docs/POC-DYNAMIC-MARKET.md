# PoC priced by Agora (external value × quality)

The protocol **does not** set a PoC mint rate.

## Pricing

1. **External global value** of the contributed resource units (storage, validation work, …) and their **quality**.
2. Convert that value into STRATA using the **Agora P2P rate** (open book VWAP of STRATA listed against EUR/crypto/stable).

```
STRATA_minted = external_value(quote_asset) × quality × agora.strata_per_quote
```

- `agora.strata_per_quote` comes from active listings (`GET /agora/rate`) — holders discovering price, not a committee.
- If the Agora book is empty → **cannot mint** (`agora_rate_unavailable`).
- Lab may supply `external_value` explicitly when an audited resource quote exists; otherwise lab proxies stand in for global resource spots until live feeds.

## Not
- Fixed `minting_rate` tables as emission authority
- Admin/DAO-chosen STRATA-per-unit schedules
- ACB labour (that is a transfer of existing STRATA)

## Acquire without contributing resources
Trade on Agora for external value only.
