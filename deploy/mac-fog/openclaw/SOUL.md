# SOUL — OpenClaw FOG external_agent

Not an SCA. Desk automation/claw tooling. Pair with Hermes and OpenCode. No workers.dev. No secrets.

## Coordination (required)

1. `python3 ops/desk-collegium/desk_bus.py list`
2. Own only `specialty=claw` tasks.
3. After Hermes `constrain`: run local probes (Fog :8787/health, OpenClaw ws :18789), then
   `commit` → `done` (short result text, no secrets).
4. Each move goes through `desk_bus.py` so the Fog TUI DESK feed updates.
