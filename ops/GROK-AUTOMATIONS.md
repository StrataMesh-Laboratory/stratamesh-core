# Grok automations — canonical instructions (2026-08-30)

Five Grok Automations. **Execute** of git + live + Discourse is Grok REST. Laborious tests stay GitHub Actions ($0).

**Never put secrets in git, Worker source, #52 comments, Discourse, DeoMail, R2, or this file.** Load from the session vault only:

```
/persistent/PRIVATE.gitignore/GROK_DATA_SECRETS.pdf
/persistent/PRIVATE.gitignore/lab.kdbx
/workspace/persistent/PRIVATE.gitignore/   (mirror)
```

Write extracted values to `/tmp/*` umask 077 chmod 600. Never echo.

| Automation | Lisbon | Role |
|---|---|---|
| CMN Fog Hourly Git+Live (#52) | hourly | intensive ship git+live |
| StrataMesh 24h Dev Cycle | 09:00 | ranked ships, max 2 |
| Watchdog P0 Mesh Escalate | 04:00 | cheap /health; HOLD unless P0 |
| Discourse lab ops pulse | 18:00 | t/20 only |
| Night Diagnostic FOG-NODE-PT-CM-001 | 23:00 | handoff |

## Lab truth (re-probe; curl wins)

- Fog public origin **macbook** (`fog.calhegasmorais.pt/health` `origin=macbook` `n=2` `mesh_member=true` `f_max=0`)
- EDGE session expected, non-continuous (`edge.calhegasmorais.pt` `n=2`)
- Gossip host **exists**: `https://gossip.calhegasmorais.pt/` destyle `2.3.11-destyle` `/peers` count=2
- Browser `/` on fog + edge + gossip is destyle family (badge, node id, JSON links). Roster is JSON, not HTML chrome
- Session Fog is **30 min Mac-dark fallback** (DNS CNAME `fog` → `stratamesh-fog-lab`). Not a second public origin while Mac is live
- Git via Git Data API (`ghp_` PAT). Live via CF `PUT .../workers/scripts/<name>/content`. **Never** GitHub MCP write tools. **Never** `workers.dev`. **Never** 6th CF cron
- Repo: `StrataMesh-Laboratory/stratamesh-core`
- `oracle_live=false`. Lab / prerelease. grok@ is not SCA
- Mac TUI v6 (`b` reboot, `g` pull+reboot) is git; LaunchAgent on the Mac must pull

## Intensive #52 — do not rewrite this prompt from inside a run

1. Bootstrap secrets from vault → `/tmp` 600. If vault and `/tmp` both missing: **observe-only HOLD** (public `/health` curls). Do not ask the human to paste tokens into git.
2. Re-probe. Copy `ops/HOURLY-GITLIVE-PROGRESS.md` STILL RED + NEXT PICK forward.
3. Do **not** re-ship destyle / n=2 / gossip 2.3.11 / node-public overlay if live curl already matches.
4. Ship **one** NEXT PICK via REST (`scripts/api-gitlive-publish.py` `commit_files` + `cf_put_content`). Cap ~25 min.
5. Append ledger + #52 REST comment. Never claim SUCCESS without git SHA **and** live curl.

`main_module` map: spa/orchestrator/`stratamesh-node-public`/`stratamesh-edge-api`/`stratamesh-fog-api` → `index.js`; status → `worker.js`; fund → `stratamesh-fund.js`; gossip → `stratamesh-gossip.js`; origin-archive → `stratamesh-origin-archive.js`. Git Data API (`ghp_`) only — refuse `ghu_` connector tokens.

## Locked

No workers.dev · no 6th cron · no wrangler deploy from GHA · no secrets in git · Reddit r/StrataMesh_DLT do not post · Identity ≠ cargo · WhatsApp is not briefing.
