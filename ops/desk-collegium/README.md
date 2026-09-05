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
