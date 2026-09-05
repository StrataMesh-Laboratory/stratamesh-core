# Scheduled jobs (Hermes desktop)

Prefer observing / notifying — do not add Cloudflare crons.
Europe/Lisbon. Skip if lane-hermes or lane-bot is STASIS.

## Collegium + Actions pulse (preferred) — hourly

```bash
export FOG_SRC=/Users/andremorais/StrataMesh/fog/repo
export FOG_HOME=/Users/andremorais/StrataMesh/fog
cd "$FOG_SRC"
python3 ops/desk-collegium/desk_protocol.py check
python3 ops/desk-collegium/desk_actions.py sync --limit 12
python3 ops/desk-collegium/desk_ops.py cycle --max 1
bash deploy/mac-fog/desk-agent-run.sh hermes
# If opencode-next.md exists, notify OpenCode peer (no secrets)
test -f "$FOG_HOME/data/desk-outbox/opencode-next.md" && echo "OpenCode brief ready"
```

Do **not** `pulse --apply` while unfinished open tasks exist (anti-vapour).
Use `desk_ops.py cycle` / `board` instead.

## Academy teach tick — with collegium pulse

Standing duty: teach SCA/ACB. Confirm academy health; leave lesson in outbox/feed.
Never enroll Hermes/OpenCode/OpenClaw as academy students.

## Morning desk pulse — 09:00

Fog `/health` + academy version + `desk_ops.py board` one-line summary.

## Weekday mail hint — 10:00 / 18:00

Remind grok@ sync — no bodies/secrets in output.
