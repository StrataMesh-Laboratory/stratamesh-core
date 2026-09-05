# RCA — Automation desk idle / vapour tasks (2026-09-05)

## Symptom
DESK feed showed ~5–8 lines in the same second, then went quiet. Open tasks stayed in `propose`/`constrain` with no deliverables. Bot routines mostly `failed`. Operators saw “activity” without outcomes.

## Timeline
| UTC | Event |
|-----|--------|
| ~00:38:45 | Collegium state restore mirrored 7 open tasks → feed burst |
| 00:38:45→ | No further agent work lines |
| a89b0a1 | Token harden dropped `desk_sync._now` → Mac `r`/60s pull/push `NameError` |
| 00:49 | Hotfix `8a4e8ad` restored `_now`; box Bearer push refreshed `synced_at` |

## Root causes (structural)
1. **Propose without execute** — `desk_bus pulse --apply` and roadmap seeding create tasks; Hermes/OpenCode/OpenClaw were documented but **no Mac/box loop bound specialty → handler → done**.
2. **Sync crash** — missing `_now` stopped `/desk` live updates so the feed looked dead even when Fog hops were up (`mac_live: true`).
3. **Vapour capacity fill** — mirroring open tasks into the feed counted as “chat” without advancing status or producing SHA/results.
4. **Metabol not gating work** — lanes ALLOW for claw/hermes/opencode while nothing consumed them; lane-bot HOLD correctly paused Bot-heavy spend but was treated as whole-desk idle.
5. **Routines ≠ desk agents** — Grok Bot routine failures (`resource_exhausted`) are a separate rail; they do not substitute for Fog desk_ops.

## Fix
- `desk_ops.py cycle` — metabol → pick **one** ALLOW specialty open task → **real handler** → commit/done → `/desk` push. Never `pulse --apply` when unfinished open work exists.
- Wire into Fog TUI `kick_desk_refresh` (r/60s) after metabol, before pull/push.
- Collegium ship majority + connectors + issues ingest (no secret bytes in git).
- Objective metrics: `idle_open_progress_60m=0`, `vapour_mirror_only=0`, `deliverable_per_cycle≥1` when any lane ALLOW and open actionable task exists.

## Non-goals
- Do not invent deliverables to fill the feed.
- Do not tap Fog `g` from Bot computer.
- Do not enroll desk agents as SCA/ACB.
