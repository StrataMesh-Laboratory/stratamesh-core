# Deno API — Fog Mac via Tailscale (no Deno Deploy)

CLI: Deno 2.9+. Not a Node rewrite. Auth stays Python `:8790`.

Deno Deploy SaaS is blocked (`SIGNUP_UNAVAILABLE`). Workaround: local `Deno.serve` on `:8792` + Tailscale. CF Workers stay the public hop. Mutual fallback is `fallback.ts` (Deno first, then `calhegasmorais.pt` — never workers.dev).

```
brew install deno
cd $FOG_SRC   # stratamesh-core
deno task start
# or:
deno run --allow-net --allow-env --allow-read ops/deno/main.ts
```

Listen: `0.0.0.0:8792` (not 8000).

```
curl -sS http://127.0.0.1:8792/health
curl -sS http://127.0.0.1:8792/object/kinds
curl -sS http://mbpv.taild31dc1.ts.net:8792/health          # tailnet
curl -sS http://mbpv.taild31dc1.ts.net:8792/status
```

Four-layer object (CID ≠ NFT) is local on this hop so Atelier compose does not spend CF Workers quota:

- `POST /object/compose` `{ creator, name, kind, parts }`
- `GET  /object/cid?cid=`
- `GET  /object/kinds`
- `GET  /resolve` — Deno vs CF first-healthy

Mail: `POST /mail/send` (DeoMail vault). Fog public origin stays the Mac tunnel. Do not pkill cloudflared.
