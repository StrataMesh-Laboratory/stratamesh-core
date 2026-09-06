# Atelier GNU renderer

Do not boot with importmap + `import * as THREE from "three"` (unpkg ESM).
On Safari/iOS the module never runs: cream canvas, dead sticks, no room.

Required: classic `three.min.js` from `frontend/vendor/three.min.js` then a normal script. No R3F. No ESM import of Three (Safari). Paint Bancada ASAP.
Live: worker `stratamesh-sandbox-host`, header `X-Atelier: 0.5.0-three-global`.
