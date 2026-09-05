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

