# Scheduled jobs (Hermes desktop)

Prefer observing / notifying — do not add Cloudflare crons.

Suggested local jobs (optional):
- Morning desk pulse 09:00 Europe/Lisbon — summarize Fog /health + academy version
- Weekday mail hint 10:00/18:00 — remind to sync grok@ (no secrets in output)

Skip if metabol HOLD/STASIS on grok-bot budget.

## Collegium bus pulse (preferred)

Hourly (Europe/Lisbon), if lane-hermes ALLOW:

```bash
python3 ops/desk-collegium/desk_bus.py pulse --apply
python3 ops/desk-collegium/desk_bus.py list
```

Then constrain open tasks that still sit on `propose`. Skip when STASIS.
