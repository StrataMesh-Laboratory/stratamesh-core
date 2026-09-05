# Fog TUI live desk feed

Operator monitor: a chat-style **DESK** panel under the Fog TUI instrument shows recent automation-desk work from each agent.

## File

`FOG/data/desk-feed.jsonl` (append-only JSONL). One object per line:

```json
{"ts":"…","t":"HH:MM:SS","agent":"hermes","kind":"propose","specialty":"coord","text":"…"}
```

- `agent` — `hermes` | `opencode` | `openclaw` | `stratagrok` | assistant short id
- `kind` — `say` | `propose` | `constrain` | `revise` | `commit` | `escalate`
- `text` — ≤240 chars, no secrets

## Append (Mac)

```bash
python3 "$FOG_SRC/deploy/mac-fog/desk-feed-append.py" hermes "propose: OpenCode patch X" --kind propose --specialty coord
```

TUI paints last ~8 lines each refresh (`draw_desk_feed` in `deploy/mac-fog/fog-tui.py`). Empty → "waiting for desk agents…".

## Who writes

| Agent | When |
|-------|------|
| Hermes | After propose / bus pulse / collegium ACK |
| OpenCode | After constrain / commit SHA |
| OpenClaw | After local loop result |
| STRATAGROK | Major Eisenhower Act start/finish (optional) |
| Fog/EDGE Assistants | Optional short Act result line (no secrets) |

Aligns with `docs/FOG-DESK-COLLEGIUM.md` bus: propose→constrain→revise→commit|escalate.

## Deny

No passwords, tokens, 2FA, workers.dev URLs, or Maildir bodies in the feed.
