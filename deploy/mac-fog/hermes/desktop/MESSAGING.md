# Messaging allowlist (Hermes desktop)

Configure in **Messaging** — leave others off.

1. **Email** — `automation.desk@calhegasmorais.pt` (shared desk Maildir; IMAP/SMTP via `~/.config/stratagrok/automation.desk.imap|.smtp`). Lead/Bot may still use grok@ — not geral@eni.
2. **Discord** — lab StrataMesh server only.
3. **Slack** — lab workspace only if it exists.
4. **WhatsApp** — Business desk path only; skip personal QR if it forks identity.

Cron / Scheduled jobs delivery: same allowlist. deliver:off is fine until channels are wired.

## desk-mail CLI (full R/W/edit for Hermes / OpenCode / OpenClaw)

Shared mailbox `automation.desk@calhegasmorais.pt` via Maildir `~/mail/automation.desk`.

```bash
desk-mail status
desk-mail sync
desk-mail list [--limit N]
desk-mail read ID|path
desk-mail search QUERY
desk-mail draft compose --to ADDR --subject '…' --body '…'
desk-mail draft edit PATH --body '…'
desk-mail draft list
desk-mail send PATH|draft   # SMTP_MODE=maildir_drop → local sent/; real SMTP loopback only by default
```

Vault paths only: `~/.config/stratagrok/automation.desk.{imap,smtp,token}` — never print passes/tokens.
**grok@** remains private Bot/Fog/EDGE gateway — not for Hermes/OpenCode/OpenClaw.
Fog/EDGE Assistants: directed (digests / Mac path) — not origin SMTP from EDGE.
See [MAIL.md](./MAIL.md) and `ops/desk-collegium/DESK-MAIL-AUTOMATION.md`.

