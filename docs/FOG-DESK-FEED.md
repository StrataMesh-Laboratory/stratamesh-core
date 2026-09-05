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

## Prefer desk_bus (task completion)

Agents should not only chat — they must complete tasks:

```bash
python3 ops/desk-collegium/desk_bus.py propose|constrain|commit|done …
```

That updates collegium state **and** appends the desk feed in one step.

## Live sync cadence

- **Updates (ongoing):** Fog TUI `r` / auto-r every **60s** → `kick_desk_refresh` → GET+POST `https://api-edge.calhegasmorais.pt/desk` (Bearer from vault).
- **Upgrades:** Fog TUI `g` / auto-g → git/brew/recycle only (not the live desk poll).
- Merge-safe: local tasks in `constrain|revise|commit` are never overwritten by a pull.
