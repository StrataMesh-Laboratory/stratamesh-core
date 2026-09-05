# Desk secrets vault — full access with discipline

Lab only. **No secret values in this file.**

## Vault roots (gitignored)

| Host | Path | Mode |
|------|------|------|
| Mac / box | `~/.config/stratagrok/` | 0700 dir · **0600** files |
| Mac / box | `~/.config/stratamesh/` | 0700 dir · **0600** files |
| Fog home | `$FOG_HOME/data/secrets/` | 0700 · 0600 files |
| KeePass | `lab.kdbx` (gitignored) | materializes into the paths above — **never** paste master password in chat/git/diary |

Common files (examples — names only): `secrets.env`, `desk-mail.token`, connector tokens, `tailscale.*` keys.

Helper: `bash deploy/mac-fog/desk-token-show.sh` (status/len; `--reveal` only on Mac local terminal).

## Access model — FULL (read + write/update)

Desk agents have **full access** to vaulted tokens they need for specialty deliverables — not read-only spectators.

- **Read** vaulted tokens when a deliverable requires them (desk sync Bearer, gh auth material, connector probes).
- **Write/update** tokens they own for their specialty (e.g. refresh `desk-mail.token`, rotate a connector token) via vault helpers / careful 0600 writes — **not** `echo` into logs.
- Prefer: `desk-token-show`, existing vault materialize scripts, `chmod 600`, atomic replace (`mv` temp → path).
- Notebook/diary may store **paths only**, never values.

## Treatment laws (all six agents)

1. **Never** print secrets to diary, notebook, DESK feed, git, chat, Pages, Discourse, screenshots, or PR bodies.
2. **Never** workers.dev · never ENI `geral@` identity mix · never commit `*.kdbx` / `secrets.env` / `desk-mail.token`.
3. Rotate on suspected leak; leave a non-secret feed line `vault: rotated <name>` without the value.
4. Files **0600**, dirs **0700**.
5. **STRATAGROK escalate only** if vault missing/corrupt/2FA/captcha — **not** for routine token use (agent_autonomy).
6. Bot-cap contingency: Mac agents keep using local vault without Bot tokens.

## Specialty ownership (write scope)

| Agent | May update (examples) |
|-------|------------------------|
| Hermes / STRATAGROK | `desk-mail.token`, desk sync Bearer paths |
| OpenCode | git/gh local auth material already on Mac (never paste) |
| OpenClaw | local probe creds only if already vaulted for claw |
| Fog Assistant | Fog/origin secrets already on Mac vault — land git+live without echoing |
| EDGE Assistant | EDGE host vault only; consume-origin; no Fog vault rewrite from EDGE thread |

Peer constrain if another specialty's vault file is touched.

## Cycle check

`ensure_desk_surfaces` verifies `.gitignore` needles + per-agent `VAULT.md` templates exist. It **never** copies secret values into outbox.
