# Hop weight — HEAD on every origin

All origins track `main`. Actions: `hop-weight.yml` → `loci-pages` + `live-from-git`.

Cheap → dear (metabolic shed):

```
pages (0) → python:8790 (1) → node:8791 (1) → workerd (2) → fog (2) → tailscale (1) → cf-worker (10) → maintenance (0)
```

`CIRCUIT=STASIS` drops `cf-worker` out of the serve set. HTML still Pages. Auth still Python.
Self-host later (Caddy + workerd + MinIO) sits in the same slot as `workerd`/`fog`, same HEAD artifact.
