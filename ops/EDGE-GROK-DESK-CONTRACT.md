# EDGE-GROK desk contract (three surfaces)

**Revised 2026-09-02** by AMCM ENI / STRATAGROK. Lab only. Docs win until a deliberate revision.

EDGE-GROK Automation Desk is **one CMN mandate on three surfaces**. Never mix Fog work into the EDGE thread (or the reverse). Never mix prompts.

Canonical paste for grok.com **Nó Calhegas Morais → Archive → Instructions** (serves **both** Assistants): [docs/NO-CALHEGAS-MORAIS-INSTRUCTIONS.md](../docs/NO-CALHEGAS-MORAIS-INSTRUCTIONS.md).

## Surfaces

| Surface | Role |
|---------|------|
| **STRATAGROK** (Grok Bot, lead) | **Escalation surface** (not routine prompter). Eisenhower rank, Git Data API, meters, desk PRs. Agents self-queue; Bot escalates gates/NACK/OOB only. Does not boot Fog from this computer. Does not origin-take. |
| **CMN FOG ASSISTANT** | Archive role: Fog **git+live**. Mac Fog hops/origin/auth/mw/Pages. One Act; self-queue when idle. |
| **CMN EDGE ASSISTANT** | Archive role: EDGE **GET consume-only**. `EDGE-GROK-CMN-001` consume-origin. No Fog origin write. One Act; self-queue GETs when idle. |

All three are Fog **staff** `role=external_assistant`, identity `grok@calhegasmorais.pt`, node `FOG-NODE-PT-CM-001`. **Not SCA.** Orchestrator `SCA-ORCH-CMN-001` / AIOps do not own this desk until handlers + `next_actions` + objective tests pass.

Metabolic stasis is **StrataMesh lab + Calhegas Morais Node token management**, not an intrinsic Assistant feature. SuperGrok does **not** refill Cloudflare or Hugging Face.

## Lab truth (2026-09-02)

- Phase: **Adversarial LAB P1**. Mesh **n=2** (Mac Fog + EDGE-GROK local). `f_max=0`. `oracle_live=false`. Do not call the lab P0 n=1.
- Public `https://fog.calhegasmorais.pt/health` may JSON `n=1` `origin=session` `mac_live=false`. That is a **session-origin flag / hop lag**, not “the lab is n=1”.
- Tag **v0.5.1-lab**. Cite live hops pack **#116** `e82ae12` (auto-g 1800s + hop skip/MW_DENO) and CI pace **#117** `5729bb2` (STASIS/HOLD = burn-rate pace; mesh pass n≥2 or TUI member).
- grok90 INV/TX evidence pack remains a **later bar** (`docs/P0-INV-TX-MULTIHOST.md`), not the current phase name.
- Do not claim aBFT / mainnet / investment.

## Write surfaces

| Surface | Owns |
|---------|------|
| GitHub `StrataMesh-Laboratory/stratamesh-core` | Code. Source of truth. Git Data API (no clone required on this desk). |
| Discourse [t/20](https://stratamesh.discourse.group/t/edge-grok-ops-pulse-mesh-api-edge-discovery-lab/20) | EDGE-GROK ops discussion |
| Hub `huggingface.co/stratamesh` | Catalog of means (not a subject) |
| Pages `https://calhegasmorais.pt` | Origin (fail-open HTML) |
| `calhegasmorais.grok.me` / `edge-stratamesh.grok.me` | Preview fallback **HOLD** until consume-origin bind |
| Reddit `r/StrataMesh_DLT` | **Banned.** Do not post. |

**Do not:** workers.dev · 6th CF cron · Worker `HF_TOKEN` · CF AI Gateway · pull the ~297 GiB RealworldQA bucket onto Fog · Upgrade clicks · mixed Assistant prompts · wrangler deploy from this desk while #80 · `env STASIS=1` Worker freeze.

## Metabolism (all three surfaces)

`decide()` first-match: **STASIS** / **P0_BORROW** / **HOLD** / **ALLOW**.

**STASIS paces; it does not freeze.** Formula **metabol v1.3**: `hourly_cap = remaining / hours_left`, `pace_factor = clamp(time_frac/spent_frac, 0.5, 1.5)`, HOLD at 1.25× unadjusted, STASIS at 2×. Reserved peak `R = remaining / hours_left * pace_factor`. Login/auth must not 503 because `decide()` is STASIS. `env STASIS=1` on a Worker is a bug.

CF Workers Free 100k req / UTC day is **Q-gated ALLOW** (pace), not “STASIS until 2026-08-29T00:00Z” (that clock is dead). Issue [#80](https://github.com/StrataMesh-Laboratory/stratamesh-core/issues/80) is the spend ledger. Freeze = temporary holding **only** until named contingency hops (auth python `:8790`, Pages HTML, sandbox host) are healthy.

| Meter | Law (2026-09-02) | Renewal |
|-------|------------------|---------|
| CF Workers Free 100k req / UTC day | Q-gated **ALLOW** + v1.3 pace. Never workers.dev. Never 6th cron (still 5/5). | UTC daily 00:00 (01:00 PT) |
| CF KV writes | 1k/day Free; same pace formula | UTC daily |
| HF Inference Providers | Never paid HF. After 2026-09-01 refill: Q-gate; HOLD if remaining 0 | vendor month |
| AWS Free | **STASIS** remaining=0 (`hard_cap: 0`) | Free only, $200/6mo. Never Paid/Support/Auto-renew. Not a Fog host. Billing alarm $1. |
| Hub whoami / catalog / static commits | **LIVE** | not a spend meter |
| xAI chat (operator key) | user-initiated only | do not Upgrade |
| grok-auto | 6 fires / Lisbon day | peaks 09:00 / 18:00 / 23:00; watchdog 04:00 still `decide()` |
| grok-bot-included | usage_limit pauses that routine **once** | SuperGrok does not refill Bot included weekly. No retry-loop. No Upgrade. |
| grok-assistant | one prompt at a time per thread | SuperGrok pool; dual-track is triple-priced |
| Discourse | 6 posts / Lisbon day | t/20 only for EDGE-GROK ops |
| DeoMail | 240 / Lisbon day | no workers.dev ingest |

**Never:** workers.dev · 6th cron · ~3 Hz host-walk · Challenge 0 spend · plan upgrades · grok.me Publish.

**Live without Worker spend:** Pages origin, Hub catalog, static Hub commits, grounded orchestrator UI (no `/actions`), local Fog `:8787` + workerd `:8788` + EDGE local, python `:8790` / node `:8791` / Deno `:8792` hops.

## Split + idle-rule

- **One scoped prompt per Assistant thread.** Ongoing + pending-after is allowed as one composite. Never a mixed Fog+EDGE todo list. Never a second prompt while that thread is still generating.
- Fog vs EDGE stay split. Both threads may be fed in the **same** Bot wake.
- **Idle-rule:** if a thread is empty and `decide()` is **ALLOW**, feed it. HOLD/STASIS is not a breach. An Assistant still generating is not a breach. Mixed/second prompt into a live thread **is** a breach of the one-prompt rule.
- Open Assistants via grok.com **Projects → Nó Calhegas Morais**, never general chat, never a new project.

Chats (existing only): Fog `grok.com/c/c765a597-f64f-4894-b238-0b9e62a0fbf2`. EDGE `grok.com/c/57f83a9d-915e-4a8a-830d-475e66c41e45`.

## Handoff without mixed prompts

1. Bot writes the fact to GitHub first (this file, `docs/HUB.md`, a PR) **or** the in-scope Assistant lands git+live itself.
2. Assistant receives **one** prompt that names that GitHub path as source of truth and **one** deliverable.
3. Result returns as a PR / PR comment or a t/20 post.

## Human gate `g`

Fog TUI `g` (update / stop / reboot) is **André on the MacBook**. Ping him in the Bot chat with **one composite pasteable block**. Ask before he taps `g`. Do not origin-take from STRATAGROK’s computer. Reload cloudflared with **SIGHUP only**.

## Merge authority

- EDGE-GROK automation-desk PRs (docs, desk Workers when ALLOW, CI pace, Fog/EDGE pack when already in desk scope): STRATAGROK / grok@.
- Core protocol consensus/crypto/auth/ledger invariants, Oracle tenancy, Renovate majors that change those: André merges.
- This revision is **docs only**.

See [METABOLISM.md](./METABOLISM.md), [docs/HUB.md](../docs/HUB.md), [docs/COMMUNITY-CHANNELS.md](../docs/COMMUNITY-CHANNELS.md), [docs/EDGE-GROK-ACTIONS-PACKAGE.md](../docs/EDGE-GROK-ACTIONS-PACKAGE.md), [docs/HOP-STASIS.md](../docs/HOP-STASIS.md). GitHub Actions is the Bot body; Grok stays Fog/tunnel + judgment.


## Desk autonomy (2026-09-05)

Laws in `ops/desk-collegium/protocol.json`: `agent_autonomy`, `bot_cap_contingency`, refined `ship_majority` (auto-ship on majority+metrics).
Mac cycle owns TODO/CONTEXT/reports/journals via `ensure_desk_surfaces` — Bot tokens not required.
