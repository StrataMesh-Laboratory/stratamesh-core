# Autonomous Fog automation desk — operational loop

**Principle:** specialization + collegium bus + metabol_pace.  
**Agents:** STRATAGROK (lead) · Hermes (coord) · OpenCode (code) · OpenClaw (claw) · Fog/EDGE Assistants (one Act each).

## Steady-state loop (no human unless gate)

```
every wake / Hermes scheduled pulse:
  1. Read ops/desk-collegium/state.json + metabol decide() lanes
  2. Rank Eisenhower (STRATAGROK) — one Act ordinal
  3. Hermes: `desk_bus.py propose|constrain|…` by specialty owner (feeds TUI DESK)
  4. Disjoint specialties run in parallel (code ∥ claw ∥ assistant Act ∥ coord)
  5. `desk_bus.py commit` then `done` → state.last_commit + desk-feed + lane paces
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

## Desk feed (Fog TUI)

After each propose/constrain/revise/commit, append a short line so the Mac Fog TUI DESK panel updates:

`python3 deploy/mac-fog/desk-feed-append.py hermes "…" --kind propose`

See `docs/FOG-DESK-FEED.md`. No secrets.
