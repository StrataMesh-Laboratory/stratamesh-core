# Fog desk ops — paced workflow

**Current cut:** `v0.6.0-lab` (lab) · debug precursor: `v0.5.2-dev`.

## Cadence
- **r / 60s:** metabol tick → mirror tasks → `/desk` pull+push (Bearer vault)
- **g / auto-g:** upgrades only (git/brew/recycle)

## Bus
```bash
REPO=$HOME/StrataMesh/fog/repo
python3 $REPO/ops/desk-collegium/desk_bus.py list
python3 $REPO/ops/desk-collegium/desk_metabol.py tick
python3 $REPO/ops/desk-collegium/desk_sync.py token-check
```

## Complete a task
1. specialty owner works under constrain
2. `desk_bus.py commit TASK --result … --sha …`
3. `desk_bus.py done TASK --result verified`

## Roadmap staging
See `docs/ROADMAP-VISION.md` and **`docs/FOG-HOST-FALLBACK.md`**. Desk state `roadmap.current` = M-I.
M-II HOLD is **distinct second host** (Mac+Pi / Mac+AWS-shaped Fog peer when ready) — **not** “Oracle only”.
Oracle grok90 remains optional rung 7; `oracle_live=false` until a real remote Fog host exists.

| Milestone | Desk focus |
|-----------|------------|
| M-I | Lab protocol, desk collegium, Fog n=2 P1 honesty (Mac+EDGE same_host OK) |
| M-II | Two-host adversarial — distinct host INV/TX (Pi/AWS/Oracle when ready; MariaDB=offload only) |
| M-III+ | Appliance → fabric → testnet → OS → terminalization → mainnet |

## Mac vault
`~/.config/stratagrok/desk-mail.token` (0600) — never git/chat.

## Collegium ship + connectors + issues

```bash
python3 ops/desk-collegium/desk_connectors.py status
python3 ops/desk-collegium/desk_issues.py sync
python3 ops/desk-collegium/desk_ship.py mark dt-desk-organ
python3 ops/desk-collegium/desk_ship.py vote dt-desk-organ ack --by hermes
python3 ops/desk-collegium/desk_ship.py vote dt-desk-organ ack --by opencode
# … majority of 6 voters (need ≥4 ACK, 0 NACK)
python3 ops/desk-collegium/desk_ship.py status dt-desk-organ
python3 ops/desk-collegium/desk_ship.py ship dt-desk-organ --by stratagrok --sha <sha>
```

Unanimous ACK ⇒ full authority. Majority ACK ⇒ ship allowed. NACK ⇒ blocked.

## GitHub Actions + agent scripts

```bash
python3 ops/desk-collegium/desk_actions.py status
python3 ops/desk-collegium/desk_actions.py sync
python3 ops/desk-collegium/desk_actions.py dispatch desk-collegium
bash deploy/mac-fog/desk-agent-run.sh all   # opencode|hermes|openclaw
```

Workflows: `desk-collegium.yml` (protocol+actions), `desk-tick.yml`, `desk-prepare.yml`.
TUI `r`/60s runs `desk_ops` then `desk-agent-run.sh all`.
Outbox: `FOG/data/desk-outbox/{opencode,hermes,openclaw}-next.md`.


## Cycle-owned surfaces (auto)

```bash
python3 ops/desk-collegium/desk_reports.py ensure-surfaces
# or via cycle / desk-agent-run — refreshes TODO.md, CONTEXT pack, reports/, journals/
```

Bot never required. Soft-ok if gh/discourse unavailable (bot_cap_contingency).

## Auto-ship

```bash
python3 ops/desk-collegium/desk_ship.py auto
python3 ops/desk-collegium/desk_ship.py metrics
```
