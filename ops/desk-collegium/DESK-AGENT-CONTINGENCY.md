# Desk agent contingency — real ladders (no mocks)

**Law:** Hermes / OpenClaw / OpenCode are equal Ollama specialists. When one is down, **do not idle** and **do not invent stubs**. Fall through real surfaces.

## Health (prove live)

| Agent | Live signal (must be real) |
|-------|----------------------------|
| **OpenClaw** | LaunchAgent `ai.openclaw.gateway` state=running + `127.0.0.1:18789` LISTEN + gateway log `ready` |
| **Hermes** | `deploy/mac-fog/hermes/desk-hermes-pulse.sh` exit 0 + meter `FOG/data/desk-meters/hermes.json` fresh |
| **OpenCode** | `desk-agent-run.sh opencode` runs real `compileall` + `unittest discover` (+ `opencode` CLI when on PATH) |
| **Fog** | `:8787/health` ok |
| **Ollama** | `:11434/api/tags` 200 |

Probe: `bash deploy/mac-fog/desk-agent-contingency.sh status`

## Ladders

### Coord (Hermes primary)
1. Hermes pulse + desk_ops / protocol / board
2. OpenClaw gateway + claw probe
3. OpenCode unittest + reports sync
4. Fog desk_ops cycle only
5. Fog Assistant Act (if ALLOW)
6. STRATAGROK escalate

### Claw (OpenClaw primary)
1. OpenClaw `:18789` + desk-claw-probe.sh
2. Hermes pulse + board
3. Fog hop curl matrix 8787-8792
4. EDGE consume-only GET
5. STRATAGROK

### Code (OpenCode primary)
1. OpenCode CLI or compileall+unittest
2. Hermes ensure_workspace + protocol
3. OpenClaw read-only audit if up
4. Fog desk_ops + local tests
5. STRATAGROK

## Anti-rules
- No ACK-only smoke as a pass
- No fake meters without a real command that ran
- OpenClaw: never reintroduce `agents.defaults.maxAgents` (causes EX_CONFIG 78)
