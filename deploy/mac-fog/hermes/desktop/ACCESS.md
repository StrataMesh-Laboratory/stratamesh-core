# ACCESS — FOG-CMN-DESK directed map (Hermes / OpenCode / OpenClaw)

**Read this as mandate.** Tools live **inside this workspace** under `bin/` — do not wait for STRATAGROK PATH.

Workspace root (this folder): `deploy/mac-fog/hermes/desktop/`  
From project cwd:

## Mail — automation.desk@ (full R/W/edit/send/sync)

```bash
./bin/desk-mail status
./bin/desk-mail sync
./bin/desk-mail list [--limit N]
./bin/desk-mail read ID|path
./bin/desk-mail search QUERY
./bin/desk-mail draft compose --to ADDR --subject '…' --body '…'
./bin/desk-mail draft edit PATH --body '…'
./bin/desk-mail draft list
./bin/desk-mail send PATH|draft
```

Address: `automation.desk@calhegasmorais.pt` · Maildir: `~/mail/automation.desk`  
Vault paths only: `~/.config/stratagrok/automation.desk.{imap,smtp,token}`  
**grok@ is private** (Bot/Fog/EDGE) — never open to Hermes/OpenCode/OpenClaw.  
Details: [MAIL.md](./MAIL.md)

## Browser — allowlisted URLs

```bash
./bin/desk-open list
./bin/desk-open browser fog-health
./bin/desk-open browser snappymail
./bin/desk-open browser academy
./bin/desk-open browser github-core
./bin/desk-open browser discourse
./bin/desk-open browser cloudflare
./bin/desk-open browser gcp
./bin/desk-open --dry-run browser fog-health
```

Roster: [desk-apps.json](./desk-apps.json) · [APPS.md](./APPS.md)

## Apps

```bash
./bin/desk-open app terminal
./bin/desk-open app finder-mail
./bin/desk-open app desk-mail
./bin/desk-open app fog-tui
./bin/desk-open app ollama
./bin/desk-open app opencode
./bin/desk-open app openclaw
./bin/desk-open app hermes
```

## Install / seed

`ensure_workspace.py` keeps `bin/` synced, copies roster to `~/.hermes/desk-apps.json`, and may also install `~/.local/bin/{desk-mail,desk-open}` — **workspace `./bin/` is canonical for agents**.

## Deny

secrets in chat · non-allowlisted URLs · workers.dev as Assistant fetch · grok@ tools for Ollama agents
