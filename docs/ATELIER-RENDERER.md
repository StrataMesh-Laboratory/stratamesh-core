# Atelier GNU renderer

Do not boot with importmap + `import * as THREE from "three"` (unpkg ESM).
On Safari/iOS the module never runs: cream canvas, dead sticks, no room.

Required: classic `three.min.js` (jsDelivr 0.160.1) then a normal script.
Live: worker `stratamesh-sandbox-host`, header `X-Atelier: 0.5.0-three-global`.
