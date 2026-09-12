# FOG-CMN-DESK linked apps (Hermes / OpenCode / OpenClaw)

Roster of applications and URLs the shared desk workspace expects. **No secrets** — paths and public/local URLs only.  
Launch via `desk-open` (allowlisted). See `~/.hermes/desk-apps.json` (written by `ensure_workspace`).

| Key | How | Target |
|-----|-----|--------|
| `browser` | `open -a` Chrome or Safari | default browser |
| `chrome` / `safari` | `open -a …` | named browser |
| `snappymail` | URL | `http://127.0.0.1:8099` — automation.desk account when configured |
| `fog-health` | URL | `http://127.0.0.1:8787/health` |
| `academy` | URL | `https://academy.calhegasmorais.pt` |
| `github` | URL | `https://github.com/StrataMesh-Laboratory` |
| `discourse` | URL | `https://forum.calhegasmorais.pt` |
| `gcp` | URL | `https://console.cloud.google.com/` |
| `cloudflare` | URL | `https://dash.cloudflare.com/` |
| `terminal` / `iterm` | `open -a` | Terminal / iTerm (iTerm optional) |
| `fog-tui` / `fog-runtime` | `open` | `deploy/mac-fog/FogRuntime.command` (alt: `fog-tui.py`) |
| `opencode` | CLI | `opencode` on PATH |
| `openclaw` | local URL/WS note | `http://127.0.0.1:18789` (WS `ws://127.0.0.1:18789`) — never dump tokens |
| `ollama` | CLI | `ollama list` |
| `maildir` | Finder | `~/mail/automation.desk` |
| `desk-mail` | CLI | `desk-mail status` |

## Commands

```bash
desk-open status                 # list linked apps
desk-open open fog-health        # open Fog health in browser
desk-open open snappymail        # local SnappyMail when up
desk-open open maildir           # Finder on shared Maildir
desk-open open desk-mail         # print desk-mail status
desk-open --dry-run open academy # print only
desk-open url http://127.0.0.1:8787/health
```

## Mail

Full R/W/edit/send/sync: `desk-mail` — see [MAIL.md](./MAIL.md).  
**grok@** stays private Bot/Fog/EDGE gateway — not linked here for Hermes/OpenCode/OpenClaw.

## Deny

secrets in chat · opening non-allowlisted URLs · workers.dev as Assistant fetch · printing vault tokens
