# Complements — same HEAD, split weight

Each CF surface has a pair that takes load when rails say HOLD/STASIS.
Nothing here replaces Pages as the public HTML origin until Caddy is proven.

| Now | Complement | When it takes weight |
|---|---|---|
| CF Pages | Caddy on Fog/VPS + GitHub Pages mirror | Pages stale or you want bytes off CF |
| CF Workers | workerd :8788 + Python :8790 + Node :8791 | Worker cap / 1027 / auth spike |
| R2 / KV / D1 | MinIO or Garage + Postgres | KV 50%+ or D1 lock |
| Fog Mac | Hetzner/Fly VM same image, Tailscale | mac_live=false > 30 min |
| Atelier sessions | Rivet actors (explore) | isolate is the wrong shape |
| FaaS toys | fn0 / Spin (explore) | never auth, never apex |

HEAD still `main` via `live-from-git` + `loci-pages` + `hop-weight`.
`Deno Deploy` is not a complement — same 100k-class cap.

Deno Deploy is **additive** with CF only if the *work* is split (status/health/HTML mirror on Deno; auth on Python; apex HTML on Pages). Same 100k-class cap twice is ~200k **distinct** requests, not 200k on `/api/auth`.
