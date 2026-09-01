# Cursor — Free account `@amcmorais` (STRATAGROK desk)

Vault (0600, never git): `~/.config/stratamesh/cursor.api` (`crsr_…`).

Generate in the **dashboard**, not the docs:

https://cursor.com/dashboard/api

Plan **Free**: `GET https://api.cursor.com/v1/me` → `plan_required` (Cloud Agent is Pro).  
Team Admin API (`/teams/members`) needs a Team key — this account is not a Team.

What Free still allows:

- App plugins / local MCP (Customize)
- BYOK in Settings → Models
- Key stored for the day you upgrade or use `agent` CLI if Cursor opens it on Free

Probe: `python3 ops/bin/cursor-probe.py` → `stasis: HOLD` on Free, not a Fog fault.
