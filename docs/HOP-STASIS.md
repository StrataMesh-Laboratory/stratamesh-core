# Hop + metabolic stasis — 2026-09-01 RCA

## What went DOWN
Cloudflare **error 1027** on `calhegasmorais.pt/*` (Workers daily request quota).
GraphQL 2026-09-01 00:00Z→12:30Z:

| script | requests |
|---|---|
| stratamesh-sandbox-host | 1.20M |
| stratamesh-auth | 0.74M |
| all other scripts | ~10k |
| **account** | **~1.95M** |

## Root causes
1. **HTML hop = Worker.** Catch-all `calhegasmorais.pt/* → stratamesh-spa` billed every home/dashboard/iframe GET.
2. **sandbox-host `Cache-Control: no-store`.** Every atelier refresh + bot + iframe = a Worker invocation.
3. **bootSession → `/api/auth/me`** on every atelier load (auth 736k).
4. **`metabolism.yml` only unit-tests the formula.** It never read live GraphQL spend. Stasis existed on paper (`ops/config/rails.json` v1.3) and was not a circuit on the hop.
5. **origin-fallback / inventory still posted to #52** (retired intensive rail).

## Hop law (structural)
| layer | what | bill |
|---|---|---|
| L0 Pages | HTML: `/`, `/dashboard`, `/login`, assets | Pages (not Workers 1027) |
| L1 Worker API | `/api/*` only, `Cache-Control` public where safe | Workers |
| L2 Node | `ops/bin/cmn-spa-node.mjs` `:8791` intensive loops | local CPU |
| L3 R2 | `cmn-origin-archive` | storage |
| L4 hold page | static 503 card on Pages if L0 missing | Pages |

**Never** put `calhegasmorais.pt/*` back on `stratamesh-spa`.

**STASIS is pace, not freeze.** Freeze is temporary holding until contingency routes (auth python hop, Pages, sandbox host).

## Contingency sequence (DOWN)
1. Detect 1027 / GraphQL hour_spent ≥ 2× hourly_cap → **STASIS**.
2. Serve apex from **Pages** `calhegasmorais-pt` (already bound to the zone).
3. Atelier: `sandbox.calhegasmorais.pt` only if under cap; else dashboard iframe → Pages copy / Node.
4. Auth `/me`: cache 60s in the browser; no poll.
5. Intensive probes → Node `:8791`, never KV `RATE_LIMIT`.
6. Human channel: daily Actions (`metabolic-stasis.yml`), not #52.

## Reestablishment (quota renews 00:00 UTC)
1. GraphQL day_spent reset → circuit ALLOW.
2. Do **not** restore spa catch-all.
3. Keep sandbox-host `public, max-age=120`.
4. Re-enable only API routes that 429'd.
5. One probe per host, then stop.

## Formula (unchanged v1.3)
`hourly_cap = remaining / hours_until_renewal(UTC 00:00)`
`STASIS` if `hour_spent ≥ 2 × cap`.
Static Pages assets do not consume the Workers 100k/plan bucket.


## Mutual mw channels (2026-09-02)

Python `:8790`, Node `:8791`, and Deno `:8792` are fallbacks of each other and of CF (Workers 100k/day reset 00:00 UTC / 01:00 PT, KV 1000 writes/day, Pages HTML). Prefer first healthy: Deno (object/mail/resolve) · python (auth/wb) · node (compose) · CF paced API. Freeze last. Never workers.dev, never spa catch-all, never a 6th cron. workerd `:8788` metabol is local meter (`HOPMESH`); do not poll `status.calhegasmorais.pt` on the TUI tick. Inbound MX stays CF Email Routing.


## Hold HTML vs live hops (2026-09-02)

`frontend/maintenance-1xxx.html` is the L4 1027 card. Live `academy.` `aiops.` `fund.` `edge.` HTML (and `/health` on academy/edge) still serve that card. Apex `calhegasmorais.pt` and `sandbox.calhegasmorais.pt` are live. Freeze-HTML leftover, not metabol pace. Restore from git Workers/Pages when ALLOW. No spa catch-all, no extra cron.


## /health outdated alias (2026-09-02)

RCA: workerd `/health` set `n` and `mesh_member` from `ORIGIN===macbook` only. Named-tunnel session hop therefore published n=1 member=false while `version` was already 0.5.1-lab and metabol origin=macbook primary. `ops/bin/outdated_aliases_check.py` only marked HTML Pages, so that JSON alias never scrubbed.

Fix: `FOG_MESH_N=2` (lab P1). `/health` n/member follow mesh n, not ORIGIN. ORIGIN stays honest (session|macbook|edge). Version/release `v0.5.1-lab`. Scrubber fails on n=1, member=false, hold HTML on /health, or missing v0.5.1-lab.
