# Desk lane meters (Mac FOG/data/desk-meters/)

JSON samples agents or operators write (0600). Consumed by `desk_metabol.py tick`.

| File | Shape |
|------|--------|
| `openclaw.json` | `{"tokens_used":2100,"tokens_limit":33000,"model":"llava:latest"}` |
| `hermes.json` | `{"context_length":65536,"tokens_used":12000,"model":"qwen2.5:7b"}` |
| `bot.json` | `{"unknown_remaining":true}` or `{"remaining_frac":0.2}` |
| `assistant.json` | `{"remaining_frac":0.96,"reset_iso":"2026-09-07T14:55:00+01:00"}` |
| `cf.json` | `{"remaining":80000,"daily_limit":100000,"hour_spent":500}` |

Renewal clocks: CF `00:00 UTC`; assistant SuperGrok weekly Lisbon; openclaw session reload; hermes/opencode host_cap + GitHub hour; bot weekly_unknown.
