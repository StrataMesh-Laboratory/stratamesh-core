# Desk camaraderie & qualitative reputation

**Status:** v0 implemented · **Date:** 2026-09-05  
**Mandate:** André — mechanisms for desk agents to help one another and delegate by **skill + qualitative reputation**, independent of KPI / objective quantitative metrics for `external_assistant` roles.

## Problem

Collegium today optimizes **verbs + ship metrics + specialty lanes** (claw/code/hermes/edge/fog/lead). That is necessary but cold: peers do not yet hold **each-to-each** trust/skill pictures that would drive help, ask, or defer when stuck — without collapsing into the same KPI scoreboard.

## Goals

1. **Camaraderie loop** — when an agent hits a blocker, peers can `refer` / `amend` / `act` to help by fit, not only by RR specialty pick.
2. **Qualitative reputation** — each agent keeps a small, dated, peer-granted picture of others (reliability, craft, teaching, calm under HOLD). Not a global ranking; not interchangeable with idle-rule / delivered counts.
3. **Delegation by skill+rep** — `pick_tasks` / handlers may consult reputation + declared skills as a **soft prior**, never as a hard gate that starves juniors or academy teaching.
4. **Independence from KPI** — objective meters (`delivered`, `ship_live`, Actions) stay for ops transparency; camaraderie/rep must not be derived from them and must not feed fund/lab-progress JSON as a vanity score.

## Non-goals

- No social credit that punishes dispute/NACK.
- No Bot-attended only design — must run on Mac desk cycle in Bot absence.
- No merging into metabol token pace.

## Sketch (v0)

| Surface | Role |
|---------|------|
| `ops/desk-collegium/reputation/` | Per-agent shard: `from→to` notes `{skill_tags[], qualitative[], updated}` |
| Bus verbs | Existing `refer`/`amend`/`help`-shaped notes; `commend` / `ask_help`; private `consult` / `consult_close` |
| `agent_roles.json` | `skills[]` + `will_help[]` declarations |
| Protocol law | `camaraderie` — peers help before André escalate; rep is peer-local |
| Feed | Verbful one-liners; rate-limit identical commend spam |

## Reputation fields (qualitative)

Examples (free text + tags, not scores 0–100):

- `craft:fog-tui` · `craft:origin-put` · `craft:mail-sync`
- `stance:teaches` · `stance:owns-blocker` · `stance:calm-hold`
- `trust:ship_review` · `trust:secrets_hygiene`

Peers **write** notes about others; self-notes are ignored or marked `self`.

## Delegation heuristic (soft)

When choosing helper for task T:

1. Specialty match (existing)
2. Peer `will_help` ∩ T tags
3. Recent qualitative notes (recency-weighted, no numeric KPI blend)
4. Else RR / lead assign

## Persistence / absence

Must evolve on `desk_ops` 60s cycle + agent diaries/notebooks without Bot. Vault not required for rep (non-secret).



## Consult (private inter-agent chat)

Bus verbs `consult` / `consult_close` open a **private** from↔to (or small peer-set) thread under
`ops/desk-collegium/consult/` (live: `$FOG_HOME/data/desk-collegium/consult/threads/*.jsonl`).

- Public DESK feed receives only an **opaque pointer** (`consult open ct-… ↔ peers`) — never the chat body.
- Integrates with `ask_help --consult` (opens a thread to the named peer).
- Absence-operable on Mac `desk_ops` / `desk_bus` without Bot; no KPI blend.

## Implemented (v0)

1. Protocol law `camaraderie` + `ops/desk-collegium/reputation/` schema/store + feed verbs `ask_help` / `commend`
1b. Private `consult` / `consult_close` threads (`consult/`) — opaque feed pointer only
2. Soft prior in `pick_tasks` (secondary) + `suggest_refer_helpers` on refer path — never starve, no KPI blend
3. `agent_roles.json` `skills[]` / `will_help[]` light declarations
4. Explicit wall: reputation module must not import/write lab-progress metrics (unit-tested)

## Next Acts

1. Academy: teach SCA/ACB the same camaraderie law (apprentice trail)
2. Optional diary/notebook echoes of peer notes without Bot
3. Rate-limit UX polish for commend spam in TUI
