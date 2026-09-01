# Strength split — Cloudflare vs Deno Deploy

Not a mirror. Each keeps the job it is better at. HEAD remains `main`.

**Cloudflare stays**
- Apex DNS, TLS, WAF, Turnstile
- Pages HTML (`calhegasmorais.pt`, sandbox host)
- Fail-open when a Worker hits the plan cap
- workerd source when circuit is ALLOW

**Deno Deploy takes**
- TypeScript APIs (status, mesh reads, Hono from `cmn-spa-node.mjs`)
- Longer request CPU than CF free 10 ms
- Deploy cycle in seconds, Deno 2 / npm closer to Node :8791

**Python :8790 keeps**
- Auth when CF `STASIS` / 405 / 1027

Do not put `/api/auth` on Deno *and* CF. Auth is one writer.
