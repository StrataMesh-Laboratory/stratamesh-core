# Landing publish 2026-08-19

Prepared:
- `landing-pt.html` / `landing-en.html` — public homepage (plain language, two engines, Fog/Edge, glossary, FAQ, single `/status` probe).
- `stratamesh-spa.home-embed.js` — `stratamesh-spa` worker with embedded homepage (`X-Home-Source: embedded-2026-08-19`).

Live domain `calhegasmorais.pt/*` is served by worker `stratamesh-spa` from D1 `site_content_chunks` (keys `home-pt` / `home-en`).

The current Cloudflare API token can **read** Workers/D1/KV but cannot **write** them (PUT worker → 403, D1 INSERT → 7500, KV PUT → 401).

To publish live (one of):
1. Cloudflare Dashboard → Workers → `stratamesh-spa` → paste `stratamesh-spa.home-embed.js` → Save & Deploy
2. Or D1 `stratamesh-ledger`, table `site_content_chunks`, replace keys `home`, `home-pt`, `landing-pt` with PT HTML in 8000-char chunks; `home-en`, `landing-en` with EN HTML.
3. Or issue a token with `Workers Scripts:Edit` + `D1:Edit` and redeploy.

Do not wipe worker bindings: LEDGER (D1), ASSETS (R2 stratamesh-fog), service bindings ACB, AGORA, AUTH, DAO, ENI_PAY, GATEWAY, ORCH, POC, REALMS, RECOVERY, SANDBOX, SCOUT, TOKEN, WORLDS. compatibility_date=2026-08-01.
