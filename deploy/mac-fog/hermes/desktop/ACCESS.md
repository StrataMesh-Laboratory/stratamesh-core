# FOG-CMN-DESK access points (directed)

This file is part of the **Hermes workspace project**. Desk agents (Hermes / OpenCode / OpenClaw)
use these paths **from this workspace** — not by guessing STRATAGROK’s PATH.

Workspace root (cwd):

`deploy/mac-fog/hermes/desktop`  
(absolute on Mac: `/Users/andremorais/StrataMesh/fog/repo/deploy/mac-fog/hermes/desktop`)

## Rule

1. `cd` to the workspace root (or set Hermes project root here).
2. Call tools via **`./bin/...`** (workspace-local). Fallback `~/.local/bin` only if `./bin` missing.
3. Read this file + [MAIL.md](./MAIL.md) + [APPS.md](./APPS.md) before mail/browser Acts.

## Mail — automation.desk@ (R/W/edit/send/sync)

**Not grok@.** grok@ is private Bot/Fog/EDGE.

```bash
./bin/desk-mail status
./bin/desk-mail sync
./bin/desk-mail list
./bin/desk-mail read <id>
./bin/desk-mail search <query>
./bin/desk-mail draft list
./bin/desk-mail draft compose --to ADDR --subject TEXT --body TEXT
./bin/desk-mail draft edit <path>
./bin/desk-mail send <draft-path>
```

Vault paths (names only): `~/.config/stratagrok/automation.desk.{imap,smtp,token}`  
Maildir: `~/mail/automation.desk`

## Browser + apps

```bash
./bin/desk-open status
./bin/desk-open list
./bin/desk-open open fog-health
./bin/desk-open open snappymail
./bin/desk-open open github-core
./bin/desk-open open discourse
./bin/desk-open open academy
./bin/desk-open open cloudflare
./bin/desk-open open gcp
./bin/desk-open open terminal
./bin/desk-open open finder-mail
./bin/desk-open open fog-tui
```

Allowlist source: [`desk-apps.json`](./desk-apps.json) (also copied under `./bin/`).

## Fog / specialty CLIs (repo-relative)

```bash
# from Fog repo root ($FOG_SRC or ../../../../ from this desktop folder's fog/repo)
python3 ops/desk-collegium/desk_ops.py cycle --max 1
bash deploy/mac-fog/desk-agent-run.sh hermes   # serialize — never stack all
bash deploy/mac-fog/desk-hermes-pulse.sh
```

## Deny

- Assuming tools exist only on STRATAGROK’s box PATH
- Opening grok@ mailbox tools from Ollama agents
- Secrets in chat/git
- workers.dev as Assistant fetch
