# automation.desk@ — ./bin/desk-mail CLI (FOG-CMN-DESK)

Shared collegium mailbox for **Hermes / OpenCode / OpenClaw** (and STRATAGROK on Mac).  
Address: `automation.desk@calhegasmorais.pt`  
Maildir: `~/mail/automation.desk`  
Vault paths only: `~/.config/stratagrok/automation.desk.{imap,smtp,token}`

**grok@ stays private** (Bot/Fog/EDGE gateway). Do not open grok@ to Hermes/OpenCode/OpenClaw.

## Commands (workspace-local canonical)

```bash
./bin/desk-mail status          # address, maildir counts, vault yes/no, MAIL_MODE/SMTP_MODE
./bin/desk-mail sync            # Worker → Maildir (desk-mail-sync.py + vault token)
./bin/desk-mail list [--limit N]
./bin/desk-mail read ID|path    # full body
./bin/desk-mail search QUERY
./bin/desk-mail draft compose --to ADDR --subject '…' --body '…'   # or --body-file
./bin/desk-mail draft edit PATH --body '…'                         # or --body-file
./bin/desk-mail draft list
./bin/desk-mail send PATH|draft # maildir_drop → sent/+new; real SMTP loopback only by default
```

## Modes

| Key | Meaning |
|-----|---------|
| `SMTP_MODE=maildir_drop` | Outbound writes Maildir `sent/` + local drop (until CF Email Sending) |
| `MAIL_MODE=imap` / Maildir | Inbound via Worker sync → Maildir; IMAP env for clients |

Never print `IMAP_PASS` / `SMTP_PASS` / tokens. See `ops/desk-collegium/DESK-MAIL-AUTOMATION.md`.

## Assistants

Fog/EDGE Assistants: directed via STRATAGROK digests / Mac path — not origin SMTP from EDGE thread.
