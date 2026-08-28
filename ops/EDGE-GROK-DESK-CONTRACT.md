# EDGE-GROK desk contract (Bot + Assistant)

**Locked 2026-08-28** by AMCM ENI. Lab only. Docs win until a deliberate revision.

STRATAGROK is **one EDGE-GROK desk on two surfaces**. Never mix prompts into Grok Assistant.

## Surfaces

| Surface | Role |
|---------|------|
| Grok Bot | Multitask operator. Fog/tunnel, grok@ mail, Discourse t/20, Hub catalog/whoami, Oracle chase, free-tier meters, desk-scope PRs. Registers the same fact on every live surface. |
| Grok Assistant | grok.com Project Space **Nó Calhegas Morais / STRATAMESH LAB**. One prompt, then execute. Protocol, preview, grok.me. Never a mixed todo list. |

Metabolic stasis is **StrataMesh lab + Calhegas Morais Node token management**, not an intrinsic Assistant feature. SuperGrok does **not** refill Cloudflare or Hugging Face.

## Write surfaces

| Surface | Owns |
|---------|------|
| GitHub `StrataMesh-Laboratory/stratamesh-core` | Code. Source of truth. |
| Discourse [t/20](https://stratamesh.discourse.group/t/edge-grok-ops-pulse-mesh-api-edge-discovery-lab/20) | EDGE-GROK ops discussion |
| Hub `huggingface.co/stratamesh` | Catalog of means (not a subject) |
| Pages `https://calhegasmorais.pt` | Origin (fail-open) |
| `calhegasmorais.grok.me` | Preview fallback when apex is broken (publish only if preview aligns) |
| Reddit `r/StrataMesh_DLT` | **Banned.** Do not post. |

**Do not:** workers.dev · 6th CF cron · Worker `HF_TOKEN` · CF AI Gateway · pull the ~297 GiB RealworldQA bucket onto Fog · Upgrade clicks · mixed Assistant prompts.

## Metabolism (both surfaces share these meters)

`decide()` first-match: **STASIS** / **P0_BORROW** (not against HF at remaining 0, not against live Worker HTTP under INC-1027) / **HOLD** / **ALLOW**.
Reserved peak `R = remaining / hours_left`.

| Meter | Now (2026-08-28) | Renewal |
|-------|------------------|--------|
| CF Workers Free 100k req / UTC day | **STASIS** `consume=0` | **2026-08-29T00:00:00Z** then Q-gated ALLOW; hold R through 31 Aug |
| HF Inference Providers | **HOLD** remaining 0, `canPay=false` | **2026-09-01T00:00:00Z** |
| Hub whoami / catalog / static commits | **LIVE** | not a spend meter |
| xAI chat (operator key) | user-initiated only | SuperGrok weekly cap through **31 Aug**; do not Upgrade |
| grok-auto | 6 fires / Lisbon day | peaks 09:00 / 18:00 / 23:00; watchdog 04:00 still `decide()` |
| Discourse | 6 posts / Lisbon day | t/20 only for EDGE-GROK ops |
| DeoMail | 240 / Lisbon day | no workers.dev ingest |

Quiet until CF refill: live Worker URLs, ~3 Hz host-walk, workers.dev, 6th cron, HF inference, bucket pull, Challenge 0, plan upgrades.
Live: Pages origin, lab twin, Hub catalog, static Hub commits, grounded orchestrator UI (no `/actions`), Desk UI, local Fog `:8787` + local EDGE `:8788`.

## P0 honesty

ROADMAP-PUBLIC-v0.3 Stage 1 (Adversarial lab).

**Still open:** multi-host INV/TX on ≥2 **real** hosts.

Current lab: `FOG-NODE-PT-CM-001` local-process n=1, `oracle_live=false`, `same_host_as_edge_local=true`. Local EDGE `EDGE-GROK-CMN-001` on `:8788` is the **same host**, not a second machine. Local `/inv` is genesis-only. Local `/gossip` and `/tx` are not wired. I1–I6 CI and resource-proof MVP already landed. Do not claim mesh. Oracle tenancy grok90 remains incident `260826-001576`.

## Next three joint moves

1. After CF refill 00:00Z: **one** Orchestrator `/health` (never `/actions`) on Pages origin. Q-gated. No workers.dev.
2. Keep the grok90 weekly chase. Second host waits on Oracle. Desk-ok gossip PRs may merge only when they record the live Fog process, not when they spend Worker quota.
3. If Project Space preview can align with `calhegasmorais.pt`, publish `https://calhegasmorais.grok.me` as INC-1027 fallback. Hub GitHub linked-accounts after huggingface.co login as `calhegasmorais`. Rotate any leaked Hub write token **on Hub settings** (never paste).

## Handoff without mixed prompts

1. Bot writes the fact to GitHub first (this file, `docs/HUB.md`, a PR).
2. Assistant receives **one** prompt that names that GitHub path as source of truth and **one** deliverable.
3. Result returns as a PR comment or a t/20 post. Never a second Assistant prompt until the first finishes.

## Merge authority

- EDGE-GROK automation-desk PRs: STRATAGROK / grok@.
- Core protocol CI, Oracle/Fog substrate, economic invariants: André merges.

See [METABOLISM.md](./METABOLISM.md), [docs/HUB.md](../docs/HUB.md), [docs/COMMUNITY-CHANNELS.md](../docs/COMMUNITY-CHANNELS.md).
