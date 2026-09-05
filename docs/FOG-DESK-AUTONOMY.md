# Autonomous Fog automation desk — operational loop

**Principle:** specialization + collegium bus + metabol_pace.  
**Agents:** STRATAGROK (lead) · Hermes (coord) · OpenCode (code) · OpenClaw (claw) · Fog/EDGE Assistants (one Act each).

## Executor (anti-vapour)

`ops/desk-collegium/desk_ops.py cycle` runs on Fog TUI `r`/60s via `kick_desk_refresh`:
metabol → pick one ALLOW open task → specialty handler → done → `/desk` push.
Never `pulse --apply` while unfinished open tasks exist. RCA: `ops/desk-collegium/RCA-DESK-IDLE.md`.

## Steady-state loop (no human unless gate)

```
every wake / Hermes scheduled pulse:
  1. Read ops/desk-collegium/state.json + metabol decide() lanes
  2. Rank Eisenhower (STRATAGROK) — one Act ordinal
  3. Hermes: open/update desk.task.v1 by specialty owner
  4. Disjoint specialties run in parallel (code ∥ claw ∥ assistant Act ∥ coord)
  5. Commit → update state.last_commit + lane paces
  6. Escalate only: g/2FA/captcha/Oracle password/Renovate majors
```

## Hermes scheduled jobs (desktop)

| Job | When (Europe/Lisbon) | Action |
|-----|----------------------|--------|
| collegium-pulse | @hourly (or :00) | Read COLLEGIUM+state; propose idle specialty tasks if ALLOW |
| fog-health | every 30m | GET :8787/health; ACK Discord/Slack only on change |
| mail-hint | weekdays 10:00/18:00 | Remind grok@ sync — no bodies/secrets |

Skip all jobs when lane-hermes or lane-bot is STASIS.

## First session after 64K fix

Paste into Hermes:

> You are FOG external_agent (not SCA). Load SOUL.md + COLLEGIUM.md + FOG-DESK-SPECIALIZATION.md. Fix complete: agent model ≥64K. Propose desk.task.v1 for OpenCode (one failing/test or desk doc needle) and OpenClaw (local :8787 health probe). Wait for constrain. Do not tap Fog `g`.

## Git human gate

STRATAGROK pings André with one composite `g` block when origin SHAs need Mac pull. Auto-g may land if André skips.
