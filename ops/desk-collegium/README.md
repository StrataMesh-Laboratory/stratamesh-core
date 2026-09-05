# desk-collegium

Live bus for Fog automation-desk agents.

- Law: [docs/FOG-DESK-COLLEGIUM.md](../../docs/FOG-DESK-COLLEGIUM.md)
- Feed: [docs/FOG-DESK-FEED.md](../../docs/FOG-DESK-FEED.md)
- CLI: `desk_bus.py` — propose → constrain → revise → commit|escalate → done|drop
- State: Mac live copy `FOG/data/desk-collegium/state.json` (mirrors repo `ops/desk-collegium/state.json`)
- Feed file: `FOG/data/desk-feed.jsonl` (Fog TUI DESK panel)

```bash
python3 ops/desk-collegium/desk_bus.py pulse --apply
python3 ops/desk-collegium/desk_bus.py list
```

Tests: `python3 -m unittest ops.desk-collegium.test_desk_bus`

## Sync CLI

```bash
python3 ops/desk-collegium/desk_sync.py token-check   # present|missing (never prints token)
python3 ops/desk-collegium/desk_sync.py pull          # live update FROM api-edge /desk
python3 ops/desk-collegium/desk_sync.py push --sha …  # push as Bearer vault holder
```

TUI calls pull+push on each 60s `r` / auto-r via `kick_desk_refresh`. `g` is upgrades only.

## Ship-live majority

```bash
python3 ops/desk-collegium/desk_ship.py mark TASK
python3 ops/desk-collegium/desk_ship.py vote TASK ack --by hermes
python3 ops/desk-collegium/desk_ship.py ship TASK --by stratagrok
```

## Connectors + Issues/Challenges

```bash
python3 ops/desk-collegium/desk_connectors.py status
python3 ops/desk-collegium/desk_issues.py sync
```


## Protocol + board (methodology enforced)

```bash
python3 ops/desk-collegium/desk_protocol.py check
python3 ops/desk-collegium/desk_ops.py board
python3 ops/desk-collegium/desk_ops.py cycle --max 1
```

Laws include **academy_teach**: all desk agents teach SCA/ACB students; never enroll as students.

## Metrics (operative score + lab progress)

```bash
python3 ops/desk-collegium/desk_metrics.py score [--n 20]
python3 ops/desk-collegium/desk_metrics.py snapshot --write
python3 ops/desk-collegium/desk_metrics.py show
```

Cycle samples append to `$FOG_HOME/data/desk-metrics.jsonl` and alias `$FOG_HOME/data/last-cycle.jsonl`.
Successful Act also refreshes committed `status/desk-lab-progress.json` (fund + Discourse metrics line).
Target score ≥ 70. Empty FOG soft-exits 0 (first boot).

## Issues / challenges → GitHub

```bash
python3 ops/desk-collegium/desk_issues.py ensure   # create/link GH issues; stamp html_url
python3 ops/desk-collegium/desk_issues.py sync
python3 ops/desk-collegium/desk_issues.py list
```

Loop: Act → metrics JSON → GH issue URL → Discourse t/20 draft (HOLD soft-skip) → fund.calhegasmorais.pt `/api/v1/lab-progress`.

## Actions + agent run

```bash
python3 ops/desk-collegium/desk_actions.py sync   # soft if gh missing (Homebrew PATH)
bash deploy/mac-fog/desk-agent-run.sh all        # no-op soft if outbox empty
python3 ops/desk-collegium/desk_ops.py token-check
```

Tests: `python3 -m unittest discover -s ops/desk-collegium -p 'test_*.py' -v`

