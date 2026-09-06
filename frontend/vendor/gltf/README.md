# vendor/gltf

Local glTF/GLB props for GNU Atelier (Pages same-origin).

- Put `.glb` / `.gltf` (+ bins) here; reference as `/vendor/gltf/<name>.glb`.
- Do not hotlink unpkg/jsdelivr for Three or loaders in production Pages.
- Keep files small; prefer instancing (`AtelierInstances`) for repeated props.
- Pipeline notes: `docs/ATELIER-GLTF-PIPELINE.md`.
