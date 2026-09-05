# Vault pointer — opencode

Specialty: **code**. Full access (read+write) to vaulted tokens needed for deliverables.

## Roots (gitignored)
- `~/.config/stratagrok/` (0600)
- `~/.config/stratamesh/` (0600)
- `$FOG_HOME/data/secrets/`
- KeePass `lab.kdbx` → materialize only (no master password in chat)

## This agent
local gh auth material — never paste tokens into patches/PRs

## Laws
See `ops/desk-collegium/SECRETS-VAULT.md`. Never print values to diary/notebook/feed/git/chat.
Escalate to STRATAGROK only if vault missing/corrupt/2FA — not for routine use.
Notebook may store **paths**, never values.

## Shared mail (automation.desk@)
- Address: `automation.desk@calhegasmorais.pt` (shared Maildir for all desk agents)
- IMAP env path: `~/.config/stratagrok/automation.desk.imap`
- SMTP env path: `~/.config/stratagrok/automation.desk.smtp`
- Optional: `~/.config/stratamesh/automation.desk.env`
- Never commit values; notebook stores **paths only**
- Sync token path: `~/.config/stratagrok/automation.desk.token`
- Contract: `ops/desk-collegium/DESK-MAIL-AUTOMATION.md`
