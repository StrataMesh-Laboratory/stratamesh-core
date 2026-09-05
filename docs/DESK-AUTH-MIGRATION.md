# Desk auth migration — grok@ → automation.desk@ (general desk)

**Date:** 2026-09-05  
**Policy:** André HALTED `grok@` for **general desk cloud auth**. Use `automation.desk@calhegasmorais.pt` instead.  
**Scope:** GENERAL DESK only — not Bot/Fog/EDGE private gateway-specific auth.

## Split table

### KEEP on `grok@calhegasmorais.pt` (do not migrate)

| Surface | Reason |
|---------|--------|
| Bot/Fog/EDGE private gateway mail (Maildir `grok-mail-sync` / `/home/box/mail/grok`) | Staff grok gateway digest path |
| SuperGrok / grok.com Assistants identity if tied to `grok@` | Product identity; do not break Assistants |
| x.ai reset paths for `grok@` | Account recovery bound to mailbox |
| Anything explicitly **staff grok gateway** | Private Bot lane |

### MIGRATE / REDIRECT to `automation.desk@calhegasmorais.pt`

| Surface | Action |
|---------|--------|
| GCP / hyperscaler Always Free / cloud VM signup | **Operator identity = `automation.desk@`** |
| Shared desk SaaS logins that are collegium-wide (new ones) | Prefer `automation.desk@` |
| Desk agent `external_assistant` mail | Already canonical on `automation.desk@` — reinforce |
| Oracle chase (OPTIONAL) | May stay on `grok@` **or** note redirect for **NEW** cloud — prefer `automation.desk@` for NEW cloud accounts going forward |
| Discourse ops identity | Prefer `automation.desk@` if not already; **do not break** live `stratamesh-grok` without care — **Note: Discourse may stay `grok@` for now** until a planned cutover |

## Redirect SOP

1. **Classify** the account: general desk / hyperscaler / collegium SaaS → migrate; Bot/Fog/EDGE gateway / SuperGrok / x.ai reset / staff grok → keep.
2. **New signups:** always use `automation.desk@calhegasmorais.pt` (never `grok@` for general desk cloud).
3. **Existing general-desk accounts:** where the provider allows email change, redirect login + recovery to `automation.desk@`; update vault pointers (names only in git).
4. **2FA/captcha:** André only — desk agents prepare the flow; do not invent secrets.
5. **Vault:** materialize under `automation.desk.*` paths (see below); never commit values or `state.json` secrets.
6. **Oracle (optional):** existing chase may remain `grok@`; any **new** cloud peer (GCP, etc.) uses `automation.desk@`.
7. **Discourse:** document preference for `automation.desk@`; leave live `stratamesh-grok` on `grok@` until explicit cutover Act.
8. **Verify:** shared Maildir/sync still works; grok-mail-sync private path untouched.

## Vault paths (names only — values never in git/chat)

Roots (gitignored, 0700/0600): `~/.config/stratagrok/` · `~/.config/stratamesh/` · `$FOG_HOME/data/secrets/`

| File | Purpose |
|------|---------|
| `automation.desk.imap` | IMAP for general desk mailbox |
| `automation.desk.smtp` | SMTP send for general desk |
| `automation.desk.token` | Worker/sync Bearer for desk-mail-sync |
| `automation.desk.env` | Optional env bundle (non-secret keys OK in docs only) |
| `desk-mail.token` | Desk sync API Bearer (Fog `/desk`) — distinct from IMAP |
| `github.pat` | Git push askpass (desk automation) — never print |

Private gateway (KEEP — do not redirect to automation.desk):

| File / path | Purpose |
|-------------|---------|
| grok-mail-sync / Maildir `grok` | Bot/Fog/EDGE private gateway |
| `staff_grok.password` (vault name only) | Staff grok gateway where applicable |

## GCP

- **Operator identity for GCP Always Free / project signup = `automation.desk@calhegasmorais.pt`.**
- See `deploy/gcp-free/README.md`.
- André: 2FA/captcha only; desk prepares gcloud flags + bootstrap.

## Related

- Mail split: `ops/desk-collegium/DESK-MAIL-AUTOMATION.md` · `docs/ops/DESK-MAIL-AUTOMATION.md`
- Roles: `ops/desk-collegium/agent_roles.json` · `ops/desk-collegium/protocol.json`
- Task: `dt-migrate-desk-auth-automation` / projected `proj-migrate-desk-auth-automation`
