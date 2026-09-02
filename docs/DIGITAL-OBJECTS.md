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
- Python `:8790` — `POST /object/compose` (`cid_only=true` / `mint=false` skips NFT), `POST /object/register`, `PUT`/`POST /object/cid` (`put_cid`), `GET /object/:id`, `GET /object/cid/:cid` (`get_cid`; 200 hit / 404 miss), `GET /object/list`. JSON + CORS. No KV. No workers.dev.

Default creator/owner: `body.creator \|\| body.owner \|\| FOG-NODE-PT-CM-001` — **not** `atelier`.

Renderer is optional: `atelier | xui | none`. Objects exist with `renderer=none`.

## Persistence

Same sqlite as Fog (`FOG_SQLITE_PATH`, default `/tmp/stratamesh-fog.db`): tables `objects`, `cid_store` (CID-only, no `object_id`), `ipfs_pins` (stub pin records; not a Kubo cluster), plus existing `transactions`.

Restart: a new `ObjectRegistry()` on the same db lists previous objects.

Catalog cases (lab): CID is content identity of the bytes (manifest + parts), DAG is the history vertex (`dag_tx`) on Fog sqlite, NFT is the network object (`object_id` / `nft.id`, never the CID), and STRATA is economic collateral reserved at 0 until `oracle_live`. C3 composes a multipart dragon that carries cid, dag_tx, object_id, `nft.id == object_id != cid`, and strata 0; C5 composes a building with four part roles into one NFT; C6 shows new bytes mint a new cid and a new object_id; C1 CID-only persist (`cid_only=true` / `mint=false` or PUT `/object/cid`) stores the CID without minting `nft.id` (null), STRATA stays 0; GET hit is 200, unknown cid is 404; C4 refuses `strata_units=1`; illegal compose/register without parts or cid fails. GNU Atelier remains a renderer only.
