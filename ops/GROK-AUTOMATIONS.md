# Grok automations — canonical instructions (2026-08-30 STASIS)

Four daily Grok Automations. Hourly #52 is **PAUSED** (SuperGrok quota hold).
**Execute** of git + live is the 09:00 slot only. Laborious tests stay GitHub Actions ($0).

**Never put secrets in git, Worker source, #52 comments, Discourse, DeoMail, R2, or this file.**
Load from the session vault only → `/tmp/*` umask 077 chmod 600. Never echo.

| Automation | Lisbon | Role | SuperGrok |
|---|---|---|---|
| STASIS hourly #52 (paused) | — | do not fire | **paused** |
| Watchdog P0 Mesh Escalate | 04:00 | cheap /health + GHA fail-watch observe | cheap |
| StrataMesh 24h Dev Cycle | 09:00 | one git+live pick (absorbed from hourly) | moderate, max 1 ship |
| Discourse lab ops pulse | 18:00 | t/20 only | cheap |
| Night Diagnostic FOG-NODE-PT-CM-001 | 23:00 | handoff + Fog-vs-git ledger | cheap |

Resume hourly only after the operator unpauses **and** quota has refilled. Do not auto-resume.

## Lab truth (re-probe; curl wins)

- Fog public origin **macbook** (`n=2` `mesh_member=true` `f_max=0`)
- EDGE session expected, non-continuous
- Gossip host **exists**: `https://gossip.calhegasmorais.pt/` `2.3.11-destyle`
- Session Fog is **30 min Mac-dark fallback**. Not a second public origin while Mac is live
- Git via Git Data API (`ghp_` PAT). Live via CF `PUT .../workers/scripts/<name>/content`. **Never** GitHub MCP write. **Never** `workers.dev`. **Never** 6th CF cron
- Repo: `StrataMesh-Laboratory/stratamesh-core`
- `oracle_live=false`. Lab / prerelease. grok@ is not SCA

## Duty map (was hourly)

1. **git+live one NEXT PICK** → 09:00 Dev Cycle. SUCCESS = SHA on origin/main AND live curl. HOLD spa PUT unless production outage.
2. **GHA fail-watch observe** → 04:00 Watchdog. **Fix** → 09:00 if Watchdog ledgered failures.
3. **Fog process vs git** → 23:00 Night Diagnostic, ledger only (Mac TUI v6 `g`).
4. **#52 REST comment** → once from 09:00, not 24 times.
5. **Discourse t/20** → 18:00 only.

## Locked

No workers.dev · no 6th cron · no wrangler deploy from GHA · no secrets in git · Reddit r/StrataMesh_DLT do not post · Identity ≠ cargo · WhatsApp is not briefing · no hourly SuperGrok loop while paused.
