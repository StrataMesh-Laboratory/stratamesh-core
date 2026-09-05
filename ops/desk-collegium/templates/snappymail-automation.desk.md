# SnappyMail — second account `automation.desk`

UI: `http://127.0.0.1:8099` (localhost only).

Add account **alongside** existing `grok@` — do not replace grok@.

| Field | Value |
|-------|--------|
| Email | `automation.desk@calhegasmorais.pt` |
| Display | Automation Desk (collegium) |
| IMAP | `127.0.0.1:143` (Dovecot) **or** Maildir bridge used by site |
| SMTP | vaulted via `~/.config/stratagrok/automation.desk.smtp` |
| Password | from vault file — **never** commit |

Standing: `external_assistant` CMN collegium. Shared by all six desk agents.
