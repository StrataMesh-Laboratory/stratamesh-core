# Fog desk collegium — channels + metabol_pace coordination

**Mandate:** CMN Fog automation desk. Lab only.  
**Extends:** `ops/EDGE-GROK-DESK-CONTRACT.md`, `ops/METABOLISM.md`, `docs/FOG-DESK-AGENTS.md`, `docs/COMMUNITY-CHANNELS.md`.

## Organizing principle: specialization\n\nEach member acts **according to its best capabilities**. See [FOG-DESK-SPECIALIZATION.md](./FOG-DESK-SPECIALIZATION.md) for the exclusive specialty map and routing rule.\n\nHermes coordinates; OpenCode codes; OpenClaw claws locally; STRATAGROK leads/meters; Fog/EDGE Assistants take one scoped Act each; André holds human gates.\n\nDesk agents work **in parallel** but stay aligned through (1) a shared bus, (2) per-agent `metabol_pace`, (3) channel roles, (4) collegial handoffs — not a single serial queue and not free-for-all.

## Members (none are SCA)

| Id | Role | Specialty | Primary channel voice |
|----|------|-----------|----------------------|
| `stratagrok` / `grok@` | `external_assistant` | Lead / Eisenhower / git / meters | Bot chat + grok@ mail |
| `hermes@fog` | `external_agent` | Desk coordinator / wizard / collegium bus | Hermes Messaging + Discord/Slack lab |
| `opencode@fog` | `external_agent` | Code / tests / patches | Hermes↔OpenCode session; PR comments |
| `openclaw@fog` | `external_agent` | Local claw / automation loops | OpenClaw ws + Hermes peer |
| CMN FOG ASSISTANT | `external_assistant` | Fog/core origin (one prompt) | Nó Calhegas Morais Fog thread |
| CMN EDGE ASSISTANT | `external_assistant` | EDGE consume-origin (one prompt) | Nó EDGE thread |

## Bus protocol (collegial)

Same spirit as academy flux: **propose → constrain → revise → commit | escalate**.

1. **Propose** — any member may open a `desk.task.v1` (JSON) on the bus file or Hermes session.
2. **Constrain** — peers with overlapping specialty reply with constraints (metabol, ownership, deny-list).
3. **Revise** — proposer updates; others ACK or NACK.
4. **Commit** — owner lands work (git / local / Assistant Act); posts `result` + SHA.
5. **Escalate** — to André (human gate: `g`, 2FA, Oracle, Renovate majors) or STRATAGROK lead.

Never mix Fog+EDGE Assistant prompts. Never enroll desk agents as SCA.

## Per-agent metabol_pace

Each member has a **pace lane**. HOLD/STASIS = slow burn, not freeze of coordination.

| Lane | Meters that gate this agent | When HOLD | When STASIS | Contingency |
|------|----------------------------|-----------|-------------|-------------|
| `lane-bot` | grok-bot-included | pause Bot-heavy loops once | stop Bot spend | Assistants ALLOW may continue |
| `lane-assistant` | grok-assistant pool_frac | one-prompt only; no dual-track | no new Assistant Acts | local Hermes/OpenCode/OpenClaw |
| `lane-hermes` | local Ollama RAM/CPU; Hermes gateway | shorten replies; no tool storms | fail-open FAQ / docs only | OpenClaw local ws |
| `lane-opencode` | Ollama + git API hour | read-only review | no pushes | STRATAGROK lands git |
| `lane-openclaw` | local ws :18789 + Ollama | reduce loops | idle connected | Hermes proposes only |
| `lane-cf` | CF Workers/KV day UTC | pace PUT/Pages | contingency hops (Pages/python) | never workers.dev |
| `lane-fog-hop` | Mac MW :8787–:8792 | skip dead hop 8s | keep tunnel; no recycle storm | complementary MW |

**Collegial rule:** before starting a parallel stream, each agent reads `ops/desk-collegium/state.json` (or Hermes bus) and **must not** take a lane already at STASIS for the same resource. Two agents may share ALLOW on **disjoint** specialties simultaneously (e.g. OpenCode patch + Hermes FAQ + OpenClaw local probe).

## Channel roles (communication)

| Channel | Collegium use |
|---------|----------------|
| Hermes Messaging (Email grok@) | Desk handoffs, Oracle/mail watch, durable decisions |
| Hermes Discord lab | Short peer ACKs / blockers (no secrets) |
| Hermes Slack lab | Same if workspace exists |
| OpenClaw deliver | Off until channel wired; then lab-only |
| Discourse t/20 | EDGE ops narrative (EDGE Assistant / Bot) — not Hermes spam |
| GitHub PR/issue | Source of truth for code coordination |
| Bot chat (this) | Human gates + lead Eisenhower |

**Deny on collegium channels:** secrets, workers.dev URLs, ENI `geral@` mix, Reddit, anonymous public.

## Simultaneous work matrix (examples)

| Parallel OK | Why |
|-------------|-----|
| OpenCode patch + Hermes doc/collegium + OpenClaw local health | Disjoint lanes |
| Fog Assistant Act + EDGE Assistant Act | Split threads; Bot feeds both |
| STRATAGROK Eisenhower + Hermes messaging setup | Lead vs local desk |

| Parallel NOT OK | Why |
|-----------------|-----|
| Two writers on same file without propose/constrain | Conflict |
| Two Assistant prompts into one generating thread | Idle-rule breach |
| Bot + Assistant both burning assistant pool on same Act | lane-assistant |
| Fog TUI `g` from Bot computer | Human Mac gate |

## Evolving alignment

- State file: `ops/desk-collegium/state.json` (schema `desk.collegium.state.v1`)
- Task envelope: `desk.task.v1` in `ops/desk-collegium/schema.json`
- Hermes desktop: load `COLLEGIUM.md` into FOG-CMN-DESK project; scheduled job = bus pulse (read state, post ACKs)
- After each major commit: owner updates state `last_commit` + `lanes`

## First wiring steps (André / Hermes UI)

1. Fog TUI `g` to pull collegium docs.
2. Hermes project `FOG-CMN-DESK` → include `COLLEGIUM.md` + `SOUL.md`.
3. Messaging: Email grok@, Discord lab, Slack lab only.
4. Bots: OpenCode + OpenClaw peers.
5. First session prompt: "Read COLLEGIUM.md; propose one desk.task.v1 for OpenCode and one for OpenClaw; wait for constrain."

## Live desk feed (Fog TUI)

Operators watch parallel agent work in the **DESK** panel under the instrument.
Append-only JSONL: `FOG/data/desk-feed.jsonl`. CLI: `deploy/mac-fog/desk-feed-append.py`.
Full spec: [FOG-DESK-FEED.md](./FOG-DESK-FEED.md).

## Operational CLI

`ops/desk-collegium/desk_bus.py` is the single write path for task status.
Open tasks live in state `open_tasks`; completion moves them to `done_tasks` and sets `last_commit`.
Every transition mirrors a line into the Fog TUI DESK feed.

## /desk sync (Bearer vault)

Holders: automation-desk vault `~/.config/stratagrok/desk-mail.token` or `DESK_TOKEN` in `secrets.env` (Mac `~/.config/stratamesh/` materialize). Never git.

- Live: TUI 60s `r` path pulls+pushes `desk.snapshot.v1` (mail + collegium + feed_tail).
- CLI: `python3 ops/desk-collegium/desk_sync.py pull|push|sync|token-check`
