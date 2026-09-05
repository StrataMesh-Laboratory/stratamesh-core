# Vault pointer — edge-assistant

Specialty: **edge**. Full access (read+write) to vaulted tokens needed for deliverables.

## Roots (gitignored)
- `~/.config/stratagrok/` (0600)
- `~/.config/stratamesh/` (0600)
- `$FOG_HOME/data/secrets/`
- KeePass `lab.kdbx` → materialize only (no master password in chat)

## This agent
EDGE host vault only; GET consume-only; no Fog vault rewrite

## Laws
See `ops/desk-collegium/SECRETS-VAULT.md`. Never print values to diary/notebook/feed/git/chat.
Escalate to STRATAGROK only if vault missing/corrupt/2FA — not for routine use.
Notebook may store **paths**, never values.
