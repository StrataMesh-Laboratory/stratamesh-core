# Atelier glTF pipeline (lab)

Vendor-local assets under `frontend/vendor/gltf/`. Classic Three only — no R3F, no ESM Three on Safari.

## Flow

1. Author / export glTF or GLB (Blender, etc.). Keep meshes lean; bake lights when possible.
2. Drop files into `frontend/vendor/gltf/` (see that README). Prefer `.glb` for Pages.
3. Load with `THREE.GLTFLoader` after `three.min.js` (and optional DRACO later). Do **not** importmap Three.
4. Attach to Bancada / lot groups; dispose with `AtelierInstances.disposeObject3D` on restyle.
5. Quality gate: `AtelierQuality.tier` may skip outlines / lower pixel ratio on weak GPUs.

## Locks

- No secrets in glTF extras.
- Parcels stay unmovable (trade title, not dirt).
- PoC mint only — no faucet, no workers.dev registry.
- Cache-bust query on HTML scripts when swapping assets (`v=YYYYMMDDoss`).

## Related

- `docs/ATELIER-RENDERER.md` — classic Three boot
- `frontend/atelier-quality.js` — tier / fog / pixelRatio
- `frontend/atelier-instances.js` — InstancedMesh + dispose
