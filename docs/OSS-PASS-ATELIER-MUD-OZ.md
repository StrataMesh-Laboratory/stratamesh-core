# OSS PASS — Atelier + MUD×STRATA + OpenZeppelin

Task `oss-pass-atelier-mud-oz` · Fog lane · git+Pages.  
Mac host matrix (brew / Ollama / OpenClaw caps) = **Bot Mac lane**, not this ship.

Lab. `oracle_live=false`. No workers.dev. No STRATA ERC-20.

## 1. Mac host (observe only)

| Check | Lane | Status |
|-------|------|--------|
| brew / Xcode CLT / dyld | Bot Mac | not this ship |
| Ollama + OpenClaw cap | Bot Mac | not this ship |
| Fog hops :8787 | Bot Mac | not this ship |

## 2. Atelier OSS — ALL PASS (this ship documents live Pages)

| Check | Evidence | PASS |
|-------|----------|------|
| Local Three, no unpkg ESM importmap | `frontend/vendor/three.min.js` + `gnu-atelier.html` `<script src="/vendor/three.min.js">` | PASS |
| Size floor before paint | `Math.max(64, clientWidth/Height)` then `paintBancadaNow` | PASS |
| First-party twin | `/gnu-atelier.html` same-origin, not `gnu-atelier.pages.dev` as maker URL | PASS |
| Enter-card off after play | `#enter` `display:none` | PASS |
| Catalog / tokenise chrome off the stage | tokenise is Rest catalog; atelier is Bancada | PASS |
| Renderer note | `docs/ATELIER-RENDERER.md` | PASS |

## 3. MUD × STRATA tables — ALL PASS (this ship)

| Check | Evidence | PASS |
|-------|----------|------|
| Object table keyed by `object_id` | `contracts/mud/tables.json` | PASS |
| CID-only without NFT | `src/cid_store.py` + Object.rules | PASS |
| Parcels unmovable | Parcel.movable implicit false / Object.movable | PASS |
| SCA/ACB are Subject rows | Subject.role enum | PASS |
| Node is not a subject | rule in Subject | PASS |
| No USDC / no on-chain STRATA mint | tables note + OZ `mintStrata` reverts | PASS |

## 4. OpenZeppelin scaffold — ALL PASS (this ship)

| Check | Evidence | PASS |
|-------|----------|------|
| Ownable mechanic, Fog operator owner | `contracts/openzeppelin/ObjectRegistry.sol` | PASS |
| No STRATA mint | `mintStrata` → `NoStrataMint` | PASS |
| Parcel transfer blocked | `ParcelImmovable` | PASS |
| Lab README, no node_modules in git | `contracts/openzeppelin/README.md` | PASS |
| Optional OZ 5.0.2 install | documented, not vendored | PASS |

Pages: `/oss-pass` → `frontend/oss-pass.html`.
