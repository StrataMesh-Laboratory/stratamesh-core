# Hermes native desk environment (FOG-CMN-DESK)

STRATAGROK’s computer cannot be shared with Hermes/OpenCode/OpenClaw.
This **Hermes desktop project** is the desk’s native workspace on André’s Mac.

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
