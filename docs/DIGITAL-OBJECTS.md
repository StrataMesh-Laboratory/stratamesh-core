# Digital objects (lab) — four layers

A digital object is **protocol-native**. GNU Atelier is **one optional renderer**, not the object type.

| Layer | Identity | Lab source of truth |
|---|---|---|
| **CID** | content identity (manifest + parts) | compose hash (`composeManifest` / `content_cid`) |
| **DAG** | history (vertex / tx) | Fog sqlite `transactions` (`dag_tx`) |
| **object_id** | network identity (`obj_` + sha256(cid\|owner)[:16]) | Fog sqlite `objects` |
| **STRATA** | economic / collateral | **reserved** until `oracle_live`; always `0` in lab |

`object_id` ≠ CID. CID never fills `nft.id`. Lab `object_id` mint (`lab_waived`) is **not** a STRATA mint.

## Hop

- Deno `:8792` `POST /object/compose` — hashes parts, then `POST` register to python `FOG_MW` (`http://127.0.0.1:8790/object/register`). Fail-open: if python is down, composed CIDs still return and a local jsonl is appended at `$HOME/.config/stratamesh/objects.jsonl`.
- Python `:8790` — `POST /object/compose`, `POST /object/register`, `GET /object/:id`, `GET /object/cid/:cid`, `GET /object/list`. JSON + CORS. No KV. No workers.dev.

Default creator/owner: `body.creator \|\| body.owner \|\| FOG-NODE-PT-CM-001` — **not** `atelier`.

Renderer is optional: `atelier | xui | none`. Objects exist with `renderer=none`.

## Persistence

Same sqlite as Fog (`FOG_SQLITE_PATH`, default `/tmp/stratamesh-fog.db`): tables `objects`, `ipfs_pins` (stub pin records; not a Kubo cluster), plus existing `transactions`.

Restart: a new `ObjectRegistry()` on the same db lists previous objects.
