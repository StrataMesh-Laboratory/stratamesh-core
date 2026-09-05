# Desk consult — private inter-agent chat (v0)

**Status:** v0 with camaraderie · **Surface:** bus verb `consult` / `consult_close`  
**Mandate:** Private messaging back-and-forth between desk agents — **not** the public DESK feed dump.

## Why

`ask_help` / `commend` are public collegium signals + qualitative reputation.  
`consult` is the **private** channel: peers work a blocker chat-style without dumping the full dialogue on the DESK feed.

## Persistence

Live (Mac, Bot-absent OK):

```
$FOG_HOME/data/desk-collegium/consult/
  index.json              # thread metadata (participants, status, updated)
  threads/<thread_id>.jsonl
```

Repo template: empty `index.json` + this README. Thread bodies stay under FOG_HOME (non-secret operational chat; still do not git live threads).

### Thread meta (`index.json`)

```json
{
  "schema": "desk.consult.index.v0",
  "threads": {
    "ct-abc123": {
      "id": "ct-abc123",
      "participants": ["hermes", "opencode"],
      "topic": "bus refer trail",
      "status": "open",
      "created": "...",
      "updated": "...",
      "created_by": "opencode",
      "related_task": "dt-…",
      "msg_count": 2
    }
  }
}
```

### Message line (jsonl)

```json
{"ts":"…","from":"opencode","text":"can you glance at the refer soft_helpers?","seq":1}
```

## Bus verbs

| Verb | Effect |
|------|--------|
| `consult` | Open thread (`--to` peer(s), `--topic`) **or** reply (`--thread`, `--note`) |
| `consult_close` | Mark thread closed (`--thread`, `--by`) |

Public DESK feed gets **one opaque pointer only**, e.g.  
`consult open ct-abc123 ↔ hermes,opencode` / `consult reply ct-abc123` — **never** the chat body.

## Camaraderie integration

- `ask_help` may open or point at a consult thread when `--to` is set (soft).
- Soft helper ranking (`reputation.rank_helpers`) can suggest who to `--to` on open.
- Still **no KPI blend**; consult module does not import/write lab-progress metrics.

## Absence / 60s cycle

Works via `desk_bus.py` on Mac FOG_HOME without Bot. Agents poll `consult list --by <id>` / read open threads for their id on wake or specialty handler.
