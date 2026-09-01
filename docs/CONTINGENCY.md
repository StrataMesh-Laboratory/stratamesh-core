# Contingency — Fog · Edge · host · Node · Workers · Python

One public origin. Several insides. Nothing grabs the apex except **Pages**.

```
Internet
  └─ Pages          HTML (home, sandbox, dashboard)
       └─ Python :8790   auth/API fallback standard   mw.calhegasmorais.pt
            └─ Node :8791    peer                       auth.calhegasmorais.pt
                 └─ Workers     /api only, under rails cap
                      └─ workerd :8788   edge|fog runtime (not apex)
                           └─ Fog :8787  Mac reference — never public origin
                                └─ Tailscale 100.x   ops when CF is dead
```

| If this fails | Next |
|---|---|
| Worker 1027 / 405 / 429 | Python `:8790` (JSON, never 405) |
| Python down | Node `:8791` |
| Both middleware down | Tailscale → `mbpv:8790` |
| Mac Fog down >30 min | Edge persist + Pages stay; do not flip Fog DNS |
| Pages stale | `outdated-aliases` / `live-from-git` |

Never: `workers.dev` as public host · `pkill cloudflared` · Fog as apex.

Rails: `ops/config/rails.json`. Auth order: `ops/config/contingency.json`.

Last layer: static `frontend/maintenance-1xxx.html` (Pages 404/500 + `/manutencao`). If every hop is dead, this page is what remains.
