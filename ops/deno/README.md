# Deno API — Fog Mac via Tailscale

CLI: Deno 2.9+. Not a Node rewrite. Auth stays Python.

On the Mac (`mbpv`):

```
brew install deno
cd ~/src/stratamesh-core   # or FOG_SRC
deno task --cwd . start
# if task paths fail:
deno run --allow-net=0.0.0.0:8792 ops/deno/main.ts
```

Default listen is Deno.serve (8000) unless you change it. For :8792, set in main later.

From this Edge hop / phone on the same tailnet:

```
curl -sS http://100.108.35.26:8000/health
curl -sS http://mbpv.taild31dc1.ts.net:8000/status
```

Deploy SaaS stays blocked (`SIGNUP_UNAVAILABLE`). Local + Tailscale is the live path.
