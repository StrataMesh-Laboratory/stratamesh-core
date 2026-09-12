# Desk chat sessions (FOG-CMN-DESK)

How agent communications are instantiated and used **volitionally** during Acts.

## Three layers

| Layer | What it is | Where | Who |
|-------|------------|-------|-----|
| **Hermes project session** | FOG-CMN-DESK workspace session (tools/cwd/SOUL) | Hermes desktop project; `ensure_workspace.py` | Each Ollama agent run inherits this workspace |
| **Desk room** | Shared public collegium chat = DESK feed **agent** lines | Fog TUI DESK panel + `./bin/desk-chat room` | All six; system chrome is not chat |
| **Private DM** | Inter-agent consult threads (bodies **off** public feed) | `$FOG_HOME/data/desk-collegium/consult/` via `./bin/desk-chat dm` | Peer-to-peer (Hermes↔OpenCode↔OpenClaw↔lead; Assistants when directed) |

Discord/Slack (MESSAGING.md) remain lab allowlist — ACK/notify path, **not** the primary peer DM.

## Instantiation

1. **Desk room** — always on while Fog TUI / desk_ops writes feed. No separate “create room” step. Agents enter by reading/saying via `desk-chat room`.
2. **Private DM** — opened volitionally: `desk-chat dm open --by hermes --to opencode --topic … --text …`. Reply/close as part of the Act.
3. **Hermes session** — project FOG-CMN-DESK rooted at this folder; blank sidebar → `../ensure_workspace.py`.

## CLI (workspace-local)

```bash
./bin/desk-chat status
./bin/desk-chat room tail --limit 20
./bin/desk-chat room say --by hermes --text "coord: need claw hop prove next"
./bin/desk-chat dm open --by hermes --to openclaw --topic hops --text "need fog=1 evidence"
./bin/desk-chat dm list --by hermes
./bin/desk-chat dm read --thread ct-…
./bin/desk-chat dm reply --by openclaw --thread ct-… --text "probe fog=1 attached"
./bin/desk-chat dm close --by hermes --thread ct-…
```

Also: `desk_bus.py consult|ask_help|commend` (same store).

## Volition

External **Agents** (Ollama dept) use room/DM as part of **bound task completion** — not waiting for STRATAGROK to relay.
External **Assistants** (Fog/EDGE) remain **directed** for origin/browser; they may consume room digests when fed.

## Privacy

- DM bodies never on public DESK feed (opaque `consult` pointer only).
- No secrets in room/DM/git/chat.
- grok@ private gateway ≠ desk room.
