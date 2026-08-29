# Optional on-graph metabolism (lab)

**Status:** Laboratory only. Optional. Not exclusive.  
**Does not mint.** Does not replace Proof of Subsistence, SPA execute burns, or NFT redeem/liquidate.  
**No mainnet. No aBFT claim. Not an investment product.**

André (2026-08-29): use metabolic stasis (`decide` / `pace_factor` / renewal) *optionally* as a **standard, not exclusive**, for STRATA *object* spend.

Companion: [`PROOF-OF-SUBSISTENCE.md`](./PROOF-OF-SUBSISTENCE.md) · [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) · [`STRATA-TOKEN.md`](./STRATA-TOKEN.md) · [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) · [`B0-EMISSION-POLICY.md`](./B0-EMISSION-POLICY.md) · [`B3-ACB-RESOURCE-METERS.md`](./B3-ACB-RESOURCE-METERS.md) · ops-monitor `METABOLISM.md`. Adapter: `src/subsistence/metabolism_opt.py`.

---

## 1. Purpose

Ops-monitor metabolism already paces *quota* rails (remaining / hours until renewal, with a 0.5–1.5 `pace_factor`). This note maps the same formula onto **on-graph STRATA objects**, when a subject **opts in**.

| Who (subject) | What (object) | Why |
|---|---|---|
| Agent that owns an NFT | NFT collateral above floor 0.1 STRATA | Preserve collateral until the SPA / CLP renewal window instead of dumping it in one execute |
| ACB that opts in | That ACB's STRATA wallet | Pace Proof of Subsistence consumption and other costs (a **debit**, not a mint — B0) |
| Registered node user | That user's STRATA consumption | Same: subject spends object |

Existing paths stay valid **without** opt-in: PoSbs `tick` / `policy.py`, `POST /spa/execute` burns, NFT liquidate / redeem.

---

## 2. Formula (normative)

```
remaining   = wallet STRATA
            | (NFT collateral − floor 0.1)
hours_left  = until that rail's renewal
              (SPA window, CLP day at node tz, or an explicit until)
hourly_cap  = remaining / max(hours_left, 1/60)
pace_factor = inflator/deflator from spend vs elapsed (clamp 0.5–1.5);
              1.0 if no spend yet (or daily_limit ≤ 0)
adjusted    = hourly_cap × pace_factor
```

- **Circuit** still trips on the **unadjusted** `hourly_cap` so a burst cannot inflate past the window (`HOLD` at 1.25×, `STASIS` at 2×).
- **Peaks** (SPA execute, user-initiated) may overdraft the hour; quiet phases compensate.
- Daily debt **can persist across renewal** if `spec.debt_persists_across_renewal` (wallet balances persist; this is not a vendor rolling-window reset).
- `workers.dev` URLs are `STASIS` if passed to `decide`. Never GET workers.dev. Never a 6th CF cron.

---

## 3. Opt-in

`src/subsistence/metabolism_opt.py` is **exclusive-off** by default.

`opted_in(meta)` is true iff `meta` / `spend_policy` is one of:

- `metabolism`
- `metabolism.v1.3`
- `true` / `True`

Anything else (missing, `false`, unknown string) → `gate_spend` returns **ALLOW** and does not call pressure mapping. Default PoSbs is unchanged.

---

## 4. Three rails (optional, not exclusive)

All three: `optional: true`, `exclusive: false`, `layer: lab`, `kind: rate`, `billing: strata`, `debt_persists_across_renewal: true`, `never_paid: n/a`.

Fragment (not yet merged into ops-monitor `rails.json` — that file is owned by metabolism v1.3): see `/tmp/metab/on-graph-rails-fragment.json` in the lab workspace.

| Rail | Subject | Object | Renewal | Notes |
|---|---|---|---|---|
| `strata-nft-collateral` | Agent (human / SCA) that owns the NFT | Collateral STRATA above floor **0.1** | SPA window or CLP day | Preserve until renewal. Floor 0.1 still reserved. **Not exclusive** vs redeem / liquidate / SPA execute |
| `acb-pos-wallet` | ACB (subject) | STRATA wallet (object) | SPA window, CLP day at node tz, or explicit until | PdS consume + other costs. **Not a mint** (B0: subsistence is a debit; PoC is the only mint). B3 heartbeat meters still consume |
| `node-user-consume` | Registered node user (subject) | STRATA consumption (object) | CLP day at node tz, or explicit until | Same mapping as ACB wallet: subject spends object |

Fog `NODE_WALLET` is **treasury infrastructure**, not a citizen. Do **not** put Fog treasury on a 'citizen consume' rail.

---

## 5. Mapping `decide()` → PoSbs pressure

Optional mapping. **Does not replace** `src/subsistence/policy.py`.

| `decide()` | PoSbs pressure | Spend |
|---|---|---|
| `ALLOW` | proceed (no extra pressure from this gate) | spend / burn within the grant (`adjusted`) |
| `HOLD` | **optimize** / defer | preserve until the next phase |
| `STASIS` | **hibernate** | no spend until renewal |
| `P0_BORROW` | consume **one** grace tick (`policy.max_grace_ticks`) | peak / P0 may overdraft; later phases compensate |

Pressure ladder from PoSbs remains: optimize / hibernate / migrate / evolve / exit. Metabolism only *paces* an opted-in wallet or collateral burn. It is not consciousness, not a substrate tax.

---

## 6. Remaining by kind

- **Wallet rails** (`acb-pos-wallet`, `node-user-consume`): `remaining = max(0, wallet STRATA)`.
- **NFT rail** (`strata-nft-collateral`): `remaining = max(0, collateral − 0.1)`. When remaining ≤ 0 → `STASIS` (floor reserved; residual-to-holders path in the NFT ontology is unchanged).

`hours_left` is supplied by the caller (SPA window, CLP day, or explicit `until`). The adapter does not invent a Fog-citizen clock.

---

## 7. Non-goals

- **Not a mint.** B0: ACB subsistence is a debit; PoC is the only mint.
- **Not exclusive.** Default PoSbs ticks, SPA execute burns above floor 0.1, and NFT redeem / liquidate remain valid without opt-in.
- **Not Fog-as-citizen.** `NODE_WALLET` stays treasury. Subjects (human, SCA / ACB, registered node user) act; objects (STRATA, NFTs) are spent / burned. Agent owns NFT; NFT never owns Agent.
- **Not mainnet.** Lab ontology and lab adapter only. No aBFT, no investment claim, no published network.
- **Not a 6th CF cron** and **not workers.dev**.

---

*Lab honest. Subjects act; objects are spent. Optional pace, not exclusive burn.*
