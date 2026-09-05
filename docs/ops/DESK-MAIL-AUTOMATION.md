# automation.desk@ — general collegium desk mail

**Address:** `automation.desk@calhegasmorais.pt`  
**Standing:** `external_assistant` for the automation desk (CMN) — identity used by **all six** desk agents for collegium send/receive and for auth where an email identity is required.  
**Not** Gmail. **Not** DeoMail / ENI `geral@eni`. **Not** workers.dev as an Assistant fetch target. Apex MX unchanged.

## Split vs `grok@`

| Mailbox | Who | Purpose |
|---------|-----|---------|
| `grok@calhegasmorais.pt` | STRATAGROK + Fog/EDGE Assistant **digest path only** | **Private** Bot/Fog/EDGE gateway. Maildir `/home/box/mail/grok` (grok-mail-sync). Keep as-is — **not** general desk cloud auth. |
| `automation.desk@calhegasmorais.pt` | **All six:** stratagrok, hermes, opencode, openclaw, fog-assistant, edge-assistant | **General collegium** shared staff mail + **canonical general desk cloud auth**. Shared client + per-agent config pointers. |

Fog/EDGE Assistants still get **sanitized digests** of `grok@` via STRATAGROK for the Assistant Act path. Collegium operational mail uses `automation.desk@`.

## General desk cloud auth (2026-09-05)

André HALTED `grok@` for **general desk cloud auth**. Canonical:

| Identity | Scope |
|----------|-------|
| `automation.desk@calhegasmorais.pt` | **General desk** — GCP/hyperscaler Always Free, collegium SaaS (new), `external_assistant` mail, NEW cloud accounts |
| `grok@calhegasmorais.pt` | **Private Bot/Fog/EDGE gateway** only — Maildir grok-mail-sync, SuperGrok/Assistants if tied, x.ai reset, staff grok gateway |

Oracle chase OPTIONAL may stay on `grok@`; prefer `automation.desk@` for **NEW** cloud. Discourse: prefer `automation.desk@` when cutting over — live `stratamesh-grok` may stay `grok@` for now (do not break without care).

Full table + redirect SOP: [`docs/DESK-AUTH-MIGRATION.md`](../DESK-AUTH-MIGRATION.md)

## Access model — both (not either/or)

### 1) Shared means (one mailbox, one client surface)

- **One Maildir** (shared):
  - Box / FOG: `/home/box/mail/automation.desk` (cur/new/tmp)
  - Mac: `~/mail/automation.desk` (same layout)
- **Shared webmail / TUI client** all agents may use:
  - SnappyMail FOSS: `http://127.0.0.1:8099` — **second account** `automation.desk` (template: `ops/desk-collegium/templates/snappymail-automation.desk.md`)
  - aerc: second account block (template: `ops/desk-collegium/templates/aerc-automation.desk.conf.example`)
- Inbound path: Cloudflare Email Routing `automation.desk@` → Worker `stratamesh-auth-recovery` `email()` → KV `desk-mail:*` → `desk-mail-sync` → shared Maildir.
- Outbound: SMTP via vaulted credentials (paths below) — never print passwords.

### 2) Per-agent configs (Hermes / OpenCode / OpenClaw + Assistants)

Each Mac agent config has a **mail** block pointing at the **same** shared mailbox and **vault path names only** (no secret values in git):

| Agent | Config surface | Mail block |
|-------|----------------|------------|
| Hermes | `deploy/mac-fog/hermes/desktop/config.yaml` (+ `config.example.yaml`) | `mail.address` + vault path pointers |
| OpenCode | `deploy/mac-fog/opencode/config.example.yaml` | same shared address/paths |
| OpenClaw | `deploy/mac-fog/openclaw/config.example.yaml` | same shared address/paths |
| STRATAGROK / Fog / EDGE | roles + `VAULT.md` | same shared vault file **names** |

Assistants on grok.com cannot reach localhost clients; they use collegium mail via STRATAGROK/Mac agents or staff-authed mesh hops — never IMAP passwords in Archive Instructions.

## Who may send / receive

| Agent | Receive (shared Maildir/client) | Send as `automation.desk@` | Auth-as email identity |
|-------|----------------------------------|----------------------------|-------------------------|
| stratagrok | yes | yes | yes (`external_assistant`) |
| hermes | yes | yes (IMAP/SMTP vault on Mac) | yes |
| opencode | yes | yes (vault paths) | yes when email identity required |
| openclaw | yes | yes (vault paths) | yes when email identity required |
| fog-assistant | yes (via shared means / Bot gateway) | ask desk / Mac path | collegium standing |
| edge-assistant | yes (consume digest / shared when on desk host) | no origin SMTP from EDGE thread | consume-only for origin |

## Vault file names (values never in git/chat)

Roots (gitignored, 0700/0600): `~/.config/stratagrok/` · `~/.config/stratamesh/` · `$FOG_HOME/data/secrets/`

| File (name only) | Purpose |
|------------------|---------|
| `automation.desk.imap` | IMAP host/user/pass material for shared mailbox (or path to secret) |
| `automation.desk.smtp` | SMTP send material |
| `automation.desk.token` | Worker/sync Bearer for `desk-mail-sync` (may mirror `auth-recovery.token` if same Worker AUTH) |
| `desk-mail.token` | Existing desk **sync API** Bearer (Fog `/desk`) — distinct from mailbox IMAP |
| `auth-recovery.token` | Existing Worker AUTH for grok-inbox; desk sync may reuse when Worker shares AUTH |

KeePass `lab.kdbx` may materialize the above — never paste master password.

## Client URL / path

| Client | Path / URL |
|--------|------------|
| SnappyMail | `http://127.0.0.1:8099` — account `automation.desk` → Maildir or local Dovecot IMAP |
| aerc | `~/.config/aerc/accounts.conf` account `[automation.desk]` |
| Maildir | `/home/box/mail/automation.desk` or `~/mail/automation.desk` |
| Sync | `deploy/mac-fog/desk-mail-sync.sh` → Python sync (Worker JSON → Maildir) |

## Cloudflare Email Routing steps

1. Zone `calhegasmorais.pt` — Email Routing **enabled**.
2. Rule (literal `to` = `automation.desk@calhegasmorais.pt`) → action **Worker** `stratamesh-auth-recovery` (same pattern as `grok@`).
3. Worker `email()` stores under KV prefix `desk-mail:` (not `grok-mail:`) when `to` contains `automation.desk`.
4. HTTP GET `/desk-inbox` (Bearer) for sync — parallel to `/grok-inbox`.
5. If API cannot create the rule: André clicks **Email Routing → Create address/rule** in CF dashboard (do not invent tokens).
6. Never point Assistants at `*.workers.dev` URLs.

## Protocol / CMN

- `automation.desk@` holds **`external_assistant`** standing for collegium communications.
- Used by desk agents for collegium mail and for **auth where email identity is required** (not ENI, not SCA enrollment).
- Laws: never workers.dev as Assistant target · never secrets in git/chat · never DeoMail/ENI mix · never Gmail.

## Ops checks

`ensure_desk_surfaces` soft-checks vault path files for `automation.desk.*`; if missing/empty → desk cycle `try_materialize_desk_mail_vault` from KeePass (Mail/AUTOMATION_DESK_*) — never empty stubs. Bot representative only if desk escalates after sources absent. Does not copy values into outbox.

## Related

- Private gateway contract (box): `/home/box/ops-monitor/DESK-MAIL.md`
- Vault doctrine: `ops/desk-collegium/SECRETS-VAULT.md`
- Roles: `ops/desk-collegium/agent_roles.json`


## Self-heal (no Bot babysit)

Lab is Adversarial **P1**. Empty `~/.config/stratagrok/automation.desk.*` is **not** an André human gate.

1. Every Fog auto-g / `fog-auto-update.sh` runs `deploy/mac-fog/ensure-desk-vault.sh` (non-fatal).
2. Desk r/60s calls `try_materialize_desk_mail_vault` (KeePass → local twins → Tailscale pull from `stratagrok-box:8765` when `~/.config/stratagrok/vault-pull.token` exists).
3. SMTP stays `maildir_drop` until CF Email Sending — inbound CF routing is separate and live.
4. True André gates remain Fog `g` / 2FA / captcha / Oracle password / Renovate majors only.
