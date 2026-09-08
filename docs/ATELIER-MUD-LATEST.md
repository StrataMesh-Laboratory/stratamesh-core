# Graphical-MUD · GNU Atelier — latest (2026-09-07)

Fog Assistant consolidation while STRATAGROK is away. Lab. `oracle_live=false`.

This page is the **index**. Do not fork a second ontology.

**Object rule (2026-09-07):** the STRATA NFT is the computable economic unit — static persist reserves collateral; dynamic state change burns C on the Object. Contract is optional. Not LAND. See [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md).

## Live (Pages)

| URL | HTTP | What |
|-----|------|------|
| [/gnu-atelier.html](https://calhegasmorais.pt/gnu-atelier.html) | 200 | First-party GNU Atelier (Bancada). Not `gnu-atelier.pages.dev` as maker URL. |
| [/oss-pass](https://calhegasmorais.pt/oss-pass) | 200 | PASS matrix HTML |
| [/atelier](https://calhegasmorais.pt/atelier) | **404** | Honest — not a fake SPA 200. Hop or real HTML only. |
| [sandbox.calhegasmorais.pt](https://sandbox.calhegasmorais.pt/) | 200 | Sandbox host `/` + `/sandbox` |

## Git (frontend)

| File | Role |
|------|------|
| `frontend/gnu-atelier.html` | Stage + classic Three + `paintBancadaNow` |
| `frontend/atelier-quality.js` | `window.AtelierQuality` · DPR clamp 1.25–1.5 |
| `frontend/atelier-instances.js` | InstancedMesh street dashes · `disposeTree` on restyleLot |
| `frontend/atelier-unix.js` | Zone/lot logic |
| `frontend/atelier-catalog.js` | Rest catalog / tokenise chrome **off** the cream stage |
| `frontend/oss-pass.html` | Public PASS card |
| `frontend/vendor/three.min.js` | Classic script (no unpkg ESM) |

## Git (world + ledger)

| File | Role |
|------|------|
| `docs/MUD-WORLD-FOG-TABLES.md` | Object / Parcel / Subject |
| `contracts/mud/tables.json` | Fog store tables |
| `contracts/mud/olissippo-*.json` | Olissippo Graphical-MUD world pack |
| `docs/ATELIER-GLTF-PIPELINE.md` | CID-first glTF; parcels not movable meshes |
| `docs/ATELIER-RENDERER.md` | Safari lock: no ESM Three |
| `docs/OSS-PASS-ATELIER-MUD-OZ.md` | Matrix + OZ PoC |
| `src/cid_store.py` | CID-only persist **legal**; NFT without CID **illegal** |

## Locks (still)

- Classic `<script>` Three. No R3F. No ESM Three on Safari.
- Size floor `Math.max(64, clientWidth/Height)` then paint. Never 0×0.
- Enter-card `display:none` after play.
- Parcels unmovable (`object_id` under title). SCA/ACB are **subjects**, not stage objects.
- PoC minter-only STRATA. No faucet. No workers.dev.

## Status

OSS PASS Atelier + MUD×STRATA + OZ scaffold: **PASS** (documented).  
Graphical-MUD world JSON lives under `contracts/mud/olissippo-*`.  
glTF bytes: drop under `frontend/vendor/gltf/` when a **classic** GLTFLoader is vendored — stand-in boxes until then.

## Next (not this commit)

- Vendor classic `GLTFLoader.js` if missing; do not pull unpkg.
- Pretty URL `/atelier` only when it serves real Atelier HTML (not SPA catch-all).
