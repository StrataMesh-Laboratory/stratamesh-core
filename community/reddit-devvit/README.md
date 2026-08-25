# Devvit app — StrataMesh Laboratory (`stratamesh-lab`)

**Complements** (does not replace):

| Layer | Role |
|-------|------|
| **Devvit** (this package) | In-subreddit: triggers, scheduler, mod menus, Redis, Reddit-hosted runtime on `r/StrataMesh_DLT` |
| **Classic script app** (`prefs/apps`) | External OAuth identity for tools that must call Reddit from **outside** Reddit |
| **CF Worker `stratamesh-community`** | Cross-platform glue: GitHub ↔ Discord ↔ optional Reddit when script tokens work |

See [docs/COMMUNITY-CHANNELS.md](../../docs/COMMUNITY-CHANNELS.md).

## Prerequisites

- Reddit account **u/amcm_eni** is moderator of **r/StrataMesh_DLT**
- Node 20+
- `npm i -g devvit` (or current Reddit CLI package)

## Quick start

```bash
cd community/reddit-devvit
npm install
devvit login          # as u/amcm_eni
devvit playtest       # installs playtest build on r/StrataMesh_DLT
```

Optional subreddit settings (after install): Discord announce webhook URL.

## What this app does (v0)

1. **onPostCreate** — skips stickies; optional lab-honesty keyword flag (report, not auto-remove by default).
2. **Scheduler `lab-status`** — weekly reminder post template (disabled until you enable cron in install settings / code).
3. **HTTP** — optional mirror to Discord webhook (secret/setting).

## Publish

```bash
npm run build
devvit upload
# Install from developers.reddit.com on r/StrataMesh_DLT
```

Lab only · not mainnet · AMCM ENI
