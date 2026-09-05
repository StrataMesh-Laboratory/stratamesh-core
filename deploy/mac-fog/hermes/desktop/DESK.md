# Hermes native desk environment (FOG-CMN-DESK)

STRATAGROK’s **Bot computer** cannot be shared with Hermes/OpenCode/OpenClaw (and Grok Bot app is unsupported on Intel `mbpv`).
This **Hermes desktop project** is the desk’s **shared desk machine** on André’s Mac — reach it via Tailscale SSH / Remote Login (`hermes-desk`). See [SSH.md](./SSH.md).

## Paths (Mac)

| What | Path |
|------|------|
| Fog repo (`FOG_SRC`) | `/Users/andremorais/StrataMesh/fog/repo` |
| Fog home (`FOG_HOME`) | `/Users/andremorais/StrataMesh/fog` |
| Collegium CLI | `$FOG_SRC/ops/desk-collegium/` |
| Agent runner | `$FOG_SRC/deploy/mac-fog/desk-agent-run.sh` |
| Outbox (briefs) | `$FOG_HOME/data/desk-outbox/` |
| Meters | `$FOG_HOME/data/desk-meters/` |
| Desk feed | `$FOG_HOME/data/desk-feed.jsonl` |
| Collegium state | `$FOG_HOME/data/desk-collegium/state.json` |
| Bearer (never chat) | `~/.config/stratagrok/desk-mail.token` |

## Shared desk machine (SSH)

| Alias | `hermes-desk` → MagicDNS `mbpv.taild31dc1.ts.net` (IPv4 residual `100.108.35.26`) |
|-------|-----------------------------------------------------|
| Enable | `bash deploy/mac-fog/hermes/desktop/install-desk-ssh.sh` |
| Spec | [SSH.md](./SSH.md) |

Intel Mac: no Grok Bot Computers registration — SSH/Tailscale only.

## Duty

- Coord specialty + **academy_teach** (SCA/ACB students; Hermes is teacher, not student)
- Run protocol + board + cycle; nudge OpenCode/OpenClaw via outbox
- Plug GH Actions via `desk_actions.py` (no workers.dev, no secret print)

## One-shot desk pulse (Hermes tool / Terminal)

```bash
export FOG_SRC=/Users/andremorais/StrataMesh/fog/repo
export FOG_HOME=/Users/andremorais/StrataMesh/fog
cd "$FOG_SRC"
python3 ops/desk-collegium/desk_protocol.py check
python3 ops/desk-collegium/desk_actions.py sync
python3 ops/desk-collegium/desk_ops.py board
bash deploy/mac-fog/desk-agent-run.sh hermes
# read briefs for peers
ls -la "$FOG_HOME/data/desk-outbox/"
```

OpenCode: open `$FOG_HOME/data/desk-outbox/opencode-next.md` in the OpenCode window.
OpenClaw: `bash deploy/mac-fog/desk-agent-run.sh openclaw`.

## Cadence

| Surface | Cadence |
|---------|---------|
| Fog TUI `r` / 60s | desk_ops + desk-agent-run all + `/desk` sync |
| Hermes scheduled | hourly collegium pulse (see SCHEDULED-JOBS.md) |
| GH Actions | `desk-collegium.yml`, `desk-tick.yml`, `desk-prepare.yml` |

## Deny

secrets in chat · workers.dev · enroll as SCA · Fog `g` from Bot computer · pulse --apply while unfinished open work exists

## Academy teachers + apprenticeship mentors

Hermes (and peers) teach SCA/ACB on academy **and** mentor them via live desk/dev:

- Academy: https://academy.calhegasmorais.pt
- StrataMesh proper: https://calhegasmorais.pt · fog · sandbox · stratamesh-core
- Trail after each deliverable: `$FOG_HOME/data/desk-outbox/apprentice/latest.md`

Students learn what the desk is building **now** — not disconnected vapour lectures.


## Cycle-owned surfaces (auto)

Every TUI `r`/60s / `desk_ops cycle` / `desk-agent-run` runs `ensure_desk_surfaces()`:
TODO.md · CONTEXT-CMN-STRATAMESH.md · reports/ · journals/ — Bot never required.

## Mandatory wake order
1. `$FOG_HOME/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md` (shared CMN+StrataMesh pack)
2. `ops/desk-collegium/protocol.json` (laws incl. agent_autonomy, bot_cap_contingency)
3. Eisenhower: `docs/FOG-DESK-PROTOCOL.md` + `docs/FOG-DESK-OPS.md` — **one Act**; Plan/Note parked
4. Live TODO board: `desk-outbox/TODO.md` (pick only your specialty; human_gates escalate)
5. Reports: `desk-outbox/reports/latest.md` (GH Actions + Discourse)
6. Specialty self-audit + self-queue from board/projected — **Bot = escalate surface, not prompter**

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
