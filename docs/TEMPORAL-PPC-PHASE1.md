# Temporal migration Phase 1 — ISO carrier → PPC authority

## Thesis

**PPC is planetary truth.**

When the mesh migrates civil authority from abstract ISO/UTC to PPC (Pontos Padrão de Convenção):

| Gain | Meaning |
|------|---------|
| Location-proof at no cost | Locality is inside the stamp (lat/lon + solar frame) |
| No UTC third party for civil time | UTC maintainers are not the authority of mesh civil time |
| Inertial frame that cannot be faked | Sun position + fixed megalithic anchors |
| Self-validating across centuries | Recompute θ/λ + phase from astronomy |
| PoC bindable to astronomical reality | Contribution epochs can reference PPC stamps |
| Contracts astronomically enforceable | Conditions on phase / JD / PPC fingerprint |

**Lost:** comfort of treating time as abstract and universal.

## Phase 1 policy (implemented)

```
authority     = PPC
civil         = CLP (relative address)
wire_carrier  = ISO-8601   // interop only — demoted from authority
schema        = stratamesh.ppc.stamp.v1
```

ISO is **not deleted**. It is demoted to a **carrier** so external systems still parse timestamps. Mesh civil meaning and validation live in the PPC stamp.

## Stamp contents

- `iso_carrier` — wire ISO string (not authority)
- `jd` — Julian Date continuum
- `clp` — civil relative address
- `solar` — local phase + sunrise/noon/sunset/nadir
- `ppc[]` — five Atlantic anchors (Almendres, Carnac, Menga, Newgrange, Stonehenge) with θ/λ
- `ppc_fingerprint` — FNV-1a of locality + phase + PPC matrix (location-proof)

## API (Orchestrator)

- `GET /ppc` — issue current CMN stamp + self-validation
- `POST /ppc` `{ iso?: string, lat?, lon?, locality? }` — ISO→PPC migration helper
- `POST /ppc/validate` `{ stamp }` — recompute and verify

## Source

`shared/holonic-clp.js` → `ppcStamp`, `validatePpcStamp`, `isoToPpc`, `TEMPORAL_POLICY`
