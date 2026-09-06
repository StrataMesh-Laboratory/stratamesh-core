# Atelier glTF pipeline (lab)

Classic scripts only. No R3F. No ESM `GLTFLoader` from unpkg. `oracle_live=false`.

## Place files

Drop `.glb` (preferred) or `.gltf` + bins under [`frontend/vendor/gltf/`](../frontend/vendor/gltf/README.md).

| Rule | Why |
|------|-----|
| One object = one `.glb` | CID is the content identity |
| No textures from CDN | Safari / metabol |
| Scale 1 unit ≈ 1 m | Bancada CGU grid |
| Origin at feet / lot base | `paintBancadaNow` spawn |
| Land parcels are **not** glTF you move | Unmovable title — Rest catalog |

## Load (when a classic GLTFLoader is vendored)

```html
<script src="/vendor/three.min.js"></script>
<script src="/vendor/GLTFLoader.js"></script>
```

```js
var loader = new THREE.GLTFLoader();
loader.load("/vendor/gltf/" + name + ".glb", function (g) {
  var root = g.scene;
  root.userData.object_id = objectId; // NFT identity, if minted
  root.userData.cid = cid;            // CID-only persist is allowed
  scene.add(root);
  if (typeof paintBancadaNow === "function") paintBancadaNow();
});
```

Do **not** ship GLTFLoader as ESM. If the r15x examples/js build is missing, keep the object as a Box/Toon stand-in until a classic loader is vendored.

## Ledger

1. Pin bytes → CID (`src/cid_store.py` — no NFT required).
2. Optional object mint → `object_id` (`src/nft.py`). Illegal: NFT without CID.
3. MUD `Object` row: `object_id`, `cid`, `movable`. Parcels: `movable=false`.
4. SCA/ACB stay in `Subject`, never in the glTF scene as objects.

## Out of scope

- Draco/meshopt CDN
- Auto-faucet STRATA when a model loads
- `workers.dev` as the mesh CDN
