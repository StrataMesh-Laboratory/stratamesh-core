# Desk metabol_pace typology

Canonical table lives in [`FOG-DESK-OPS.md`](./FOG-DESK-OPS.md#metabol_pace-platform-typology).
Code: `ops/desk-collegium/desk_metabol.py` → `PLATFORM_SPECS` + `compute_platforms()` + `platform_allows()`.
Gates: `desk_ops._platform_allows`, `desk_origin_put.put_live` (fund/origin skip on HOLD/STASIS; Pages ALLOW).

`metabol_pace=true` is written on every `desk_metabol.tick()`.
