# OpenCode desk environment

Native Mac specialty seat for **code**. STRATAGROK Bot computer is separate.

## Paths (Mac)
| What | Path |
|------|------|
| Fog repo | `$FOG_SRC` = `/Users/andremorais/StrataMesh/fog/repo` |
| Outbox | `$FOG_HOME/data/desk-outbox/` |
| TODO board | `$FOG_HOME/data/desk-outbox/TODO.md` |
| CONTEXT pack | `$FOG_HOME/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md` |
| Reports | `$FOG_HOME/data/desk-outbox/reports/` |
| Journals | `$FOG_HOME/data/desk-outbox/journals/<agent>/` |
| Meters | `$FOG_HOME/data/desk-meters/` |

## Mandatory wake order
1. `$FOG_HOME/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md` (shared CMN+StrataMesh pack)
2. `ops/desk-collegium/protocol.json` (laws incl. agent_autonomy, bot_cap_contingency)
3. Eisenhower: `docs/FOG-DESK-PROTOCOL.md` + `docs/FOG-DESK-OPS.md` — **one Act**; Plan/Note parked
4. Live TODO board: `desk-outbox/TODO.md` (pick only your specialty; human_gates escalate)
5. Reports: `desk-outbox/reports/latest.md` (GH Actions + Discourse)
6. Specialty self-audit + self-queue from board/projected — **Bot = escalate surface, not prompter**


Surfaces are **cycle-owned** (`ensure_desk_surfaces` on every TUI `r`/60s). Bot never required to regenerate.


```bash
bash deploy/mac-fog/desk-agent-run.sh opencode
# read TODO.md — pick specialty=code only
```

## Mail — automation.desk@ (shared client + per-agent pointers)

Shared desk mailbox for **all** Mac terminal agents (Hermes / OpenCode / OpenClaw) **and** external_assistant CMN standing:

| What | Value / path (paths only — never passwords in git) |
|------|------------------------------------------------------|
| Address | `automation.desk@calhegasmorais.pt` |
| Role | shared Maildir / desk client (not geral@eni; not personal) |
| IMAP env file | `~/.config/stratagrok/automation.desk.imap` (0600) |
| SMTP env file | `~/.config/stratagrok/automation.desk.smtp` (0600) |
| Alias pointer | `~/.config/stratamesh/automation.desk.env` (optional materialize) |
| Desk Bearer (sync) | `~/.config/stratagrok/desk-mail.token` (separate from IMAP pass) |

Ollama / terminal agent setup: point Messaging→Email at **automation.desk@**; load IMAP/SMTP from the env files above (key=value, no commit). Shared Maildir **plus** each agent's own config.yaml / DESK.md pointers — not instead of shared.

Deny: print credentials · workers.dev · ENI `geral@` mix · git of `*.imap` / `*.smtp` / `desk-mail.token`.
