# OSS inspire map — 2026-08-29 (v0.2.3-lab)

**Rule:** absorb **mechanics**, not ontology. STRATA mint stays PdC-only. No USDC into #mint. No 6th cron. No workers.dev ingest. Lab n=1.

Companion to [OPEN_SOURCE_SWEEP.md](./OPEN_SOURCE_SWEEP.md) (2026-08-20). This file is **what they shipped since then** and **what CMN should copy as structure**, not as tokens.

## Dimension matrix

| Dim | Adjacent (recent) | Structural problem they closed | Do **not** copy | CMN surface | Ord |
|---|---|---|---|---|---|
| DAG / tips | IOTA **Rebased** (dPoS, storage fees, left Tangle 2.0) | Validator set + storage rent; feeless IoT DAG did not scale their org | Rebased chain, AKT/IOTA fees, abandoning GDA | Keep R-URTS + MCMC on `stratamesh-consensus`. Add **storage-rent analog** as PdS burn for D1/R2 bytes, not a second token | P1 |
| Gossip | libp2p **gossipsub 0.49.5** (2026-07): mesh degree D≈6 (4–12); Holochain **0.5 kitsune2** gossip rewrite | Unbounded flood vs bounded mesh; wire-protocol break to get gossip cheap | Full libp2p on Workers; Holochain conductor | Bound gossip **fan-out** (already Cache API 60s on `/peers`). Next: **IHAVEs** (IDs only) not full events; D_lab=2 (Fog+EDGE) honest | P0 |
| DePIN | Akash **Mainnet 14** + SDL **2.0** (home provider, `params.tee`) | Home supply + confidential compute via one SDL line | k8s provider, AKT, TEE on Workers | SDL-lite already. Add `idle_only: true` + `c_mesh: f(1-U)` field matching EDGE-GROK. TEE = Fog metal later | P1 |
| Agents | Cloudflare **Agents SDK 0.21.0** (2026-08-18): Durable Objects, hibernate $0, **fibers**, **Facets** sub-agents; Project Think | Cron-polling agents burn quota; crash loses intent | grok@ as SCA; extra CF cron; paid DO if it blows Free | Orchestrator = parent actor; AIOps = Facets. **Hibernate** when no event. Desk stays Grok execute | P0 |
| Agent pay | **x402** (Linux Foundation 2026-04): HTTP 402 + deferred settlement | Per-call API keys / accounts for machines | USDC / Base into STRATA mint | `402` + `{pay: "PdS", burn_to:"#0", amount}` on paid Worker routes. ENI/x402 **parallel** only | P1 |
| Isolate | CF **Sandbox GA** (2026-04): persistent Linux + R2 snapshots | Agent code has no computer | Running CF Sandbox on Free as default | Bancada CGU stays **NFT objects**. Auth the open `POST /sandbox/create`. Optional Fog-side isolate later | P0 |
| Storage | Autonomi (MaidSafe) pay-once persist; Helia HTTP-only | Subscriptions vs one-shot persistence; P2P won't run in Workers | ANT token; Helia webrtc in Worker | CID on `stratamesh-ipfs` + R2. Helia **browser verify** of pins. No pay-forever token | P2 |
| Identity | Urbit moons; Holochain **agent-centric** hashes (0.5–0.6 iroh transport) | Appointment vs identity; transport churn | Azimuth ETH, running a ship | Already: Fog operator / Edge none / grok@ ≠ SCA. Keep | — |
| Actor DB | Durable Objects SQLite per agent (Free tier exists) | Global D1 as single chokepoint (our KV 50% / holons `/boot` 15s) | Putting every NFT in one D1 table forever | Split hot SCA/sandbox rows to **per-id DO** when Free allows; keep D1 for catalog | P1 |

## What they solved that we still hurt on

1. **Quota death by polling** — CF Agents hibernate; we poll holons `/boot` and diagnostics `.workers.dev`. Plan: event-wake + Cache API (status already).
2. **Flood gossip** — gossipsub bounded D; we list 2 peers but any probe loop 2× EDGE. Plan: keep 60s cache; add IHAVE digest.
3. **Open sandbox writes** — CF Sandbox is identity-bound; our `POST /api/v1/sandbox/create` and `/publish` and `POST /acb/register` succeeded **with no Bearer** (desk test 2026-08-29). Plan: require session or Fog Bearer; isolated default.
4. **One ledger for all objects** — token `/list` 6–8s. DO-per-owner or paginate `limit` default 20.
5. **Machine pay** — x402 402-retry. Our PdS is the analog; wire HTTP 402 on `/api/v1/token/spa/execute` rather than silent 200.
6. **IOTA left the DAG** — do **not**. Their structural fix (rent) maps to #0, not to dPoS.

## Technical plan (lab slices)

Cap 1–3 ships per Dev Cycle. Handler = `id, priority, owner, verb, success_check, effort`.

### Slice A — P0 close-open-writes (dashboard honesty)
- **verb:** Bearer or session on `POST /sandbox/create|publish|integrate` and `POST /acb/register`. Unauth → 401.
- **success_check:** unauth POST 401; auth POST 200 isolated (not published).
- **owner:** security · **effort:** M
- **do not:** delete existing 44 sandboxes; tombstone desk-probe `sbx_dd302441-5` only if operator GO.

### Slice B — P0 hibernate agents (CF Agents model, no 6th cron)
- **verb:** Orchestrator + AIOps: Durable Object or alarm-wake; remove workers.dev boot fetch from dashboard `SVC.holons`.
- **success_check:** dashboard holons panel uses `/api/v1/holons/*` only; `/boot` < 1.5s or honest `{ok:false,error,timeout}`.
- **owner:** orchestrator · **effort:** L
- **do not:** add CF cron; grok@ is not an SCA.

### Slice C — P0 gossip IHAVE (gossipsub D)
- **verb:** `GET /peers` stays cached; add `GET /events?have=` digest; no full graph on probe.
- **success_check:** `/peers` cache hit; probe loop does not 2× EDGE Worker.
- **owner:** mesh · **effort:** S
- Already: Cache API 60s, custom domain `gossip.calhegasmorais.pt`.

### Slice D — P1 PdS-402 (x402 shape, STRATA rail)
- **verb:** paid routes return `402` + `{burn_to:"#0"}`; client retries after PdS.
- **success_check:** unauth execute 402; no USDC field.
- **owner:** economy · **effort:** M
- **do not:** Cloudflare Monetization Gateway waitlist as mint path.

### Slice E — P1 SDL idle_only (Akash 2026 home-provider idea)
- **verb:** DePIN order `sdl.idle_only=true` maps to EDGE `C_mesh=f(1-U)`.
- **success_check:** order without idle_only still lab; with flag rejected if utilisation high (synthetic U).
- **owner:** mesh · **effort:** S

### Slice F — P1 token list pagination (DO later)
- **verb:** `/api/v1/token/list?limit=20` default; dashboard AbortSignal 10s → 15s or paginate.
- **success_check:** p95 list < 2s for limit=20.
- **owner:** devops · **effort:** S

### HOLD
- IOTA Rebased / Sui Move
- x402 USDC settlement
- Holochain conductor / iroh
- Autonomi ANT
- CF Sandbox GA as default bancada (paid/quota)
- 6th cron, workers.dev ingest, P0 multi-host close

## Mapping sketch

```
CF Agents hibernate ──► SCA/Orchestrator wake-on-event (not hourly invent)
gossipsub D=6     ──► D_lab=2 + IHAVE + 60s cache (already peers)
x402 HTTP 402     ──► PdS 402 on execute (not USDC)
Akash SDL 2.0     ──► idle_only on DePIN orders
CF Sandbox ident  ──► session on bancada writes
IOTA storage rent ──► #0 burn for stored bytes (not Rebased)
Durable Object    ──► per-SCA state when Free allows (not extra Worker)
```

Last map: 2026-08-29 · lab only · no investment claims.
