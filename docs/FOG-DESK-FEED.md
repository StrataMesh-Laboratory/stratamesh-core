# Fog TUI live desk feed

Operator monitor: a chat-style **DESK** panel under the Fog TUI instrument shows recent automation-desk work from each agent.

## File

`FOG/data/desk-feed.jsonl` (append-only JSONL). One object per line:

```json
{"ts":"…","t":"HH:MM:SS","agent":"hermes","kind":"propose","specialty":"coord","text":"…"}
```

- `agent` — `hermes` | `opencode` | `openclaw` | `stratagrok` | assistant short id
- `kind` — `say` | `propose` | `constrain` | `act` | `audit` | `amend` | `revise` | `vote` | `refer` | `dispute` | `commit` | `escalate` | `done` | `drop`
- `text` — ≤240 chars, no secrets

## Append (Mac)

```bash
python3 "$FOG_SRC/deploy/mac-fog/desk-feed-append.py" hermes "propose: OpenCode patch X" --kind propose --specialty coord
```

TUI paints the DESK panel each refresh (`draw_desk_feed` in `deploy/mac-fog/fog-tui.py`).
**Layout:** feed height = `desk_feed_rows_for(term_rows, desk_start)` — terminal rows minus header/hops/STRATA/HOST/menu chrome; clamped; scrolls within that region; pads so the panel **fills down to the last usable row** (no large empty band above the menu, not clipped below). Empty → "waiting for desk agents…".

## Who writes

| Agent | When |
|-------|------|
| Hermes | After propose / bus pulse / collegium ACK |
| OpenCode | After constrain / commit SHA |
| OpenClaw | After local loop result |
| STRATAGROK | Major Eisenhower Act start/finish (optional) |
| Fog/EDGE Assistants | Optional short Act result line (no secrets) |

Aligns with `docs/FOG-DESK-COLLEGIUM.md` bus full verb set: propose/act/audit/amend/revise/vote/refer/dispute/constrain/commit/escalate/done (propose is not the only move).

## Deny

No passwords, tokens, 2FA, workers.dev URLs, or Maildir bodies in the feed.

## Prefer desk_bus (task completion)

Agents should not only chat — they must complete tasks:

```bash
python3 ops/desk-collegium/desk_bus.py propose|act|audit|amend|revise|vote|refer|dispute|constrain|commit|done …
```

That updates collegium state **and** appends the desk feed in one step.

## Live sync cadence

- **Updates (ongoing):** Fog TUI `r` / auto-r every **60s** → `kick_desk_refresh` → GET+POST `https://api-edge.calhegasmorais.pt/desk` (Bearer from vault).
- **Upgrades:** Fog TUI `g` / auto-g → git/brew/recycle only (not the live desk poll).
- Merge-safe: local tasks in `constrain|revise|commit` are never overwritten by a pull.


## DESK panel geometry (Fog TUI)

Invariant (`desk_feed_rows_for` in `fog-tui.py`):

- `feed_rows = term_rows - desk_start_row - chrome_after + 1` (chrome_after = bot+menu+instr = 3)
- Clamp: prefer ≥4 when space allows, else ≥2
- `draw_desk_feed` pads blank rows to the budget so the panel fills to the last usable terminal row
- Hop/host chrome above DESK is fixed; DESK absorbs remaining height (scroll content inside)

