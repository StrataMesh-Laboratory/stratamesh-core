# Desk qualitative peer reputation (v0)

**Status:** v0 implemented · **Law:** `camaraderie` in `protocol.json`  
**Mandate:** Peer-local, qualitative only — never a 0–100 score; never blended into KPI / `delivered` / `ship_live` / fund / `desk-lab-progress.json`.

## Store

Canonical JSON: `reputation.json` (repo template empty; live copy under `$FOG_HOME/data/desk-collegium/reputation/`).

Optional per-agent shards (`<agent_id>.json`) may mirror notes **about** that agent (`to == agent_id`). Live writes go through `store.py` and update both the aggregate file and the `to` shard.

### Note shape

```json
{
  "from": "hermes",
  "to": "opencode",
  "skill_tags": ["craft:fog-tui", "stance:teaches"],
  "qualitative": ["clear patch trail under HOLD"],
  "updated": "2026-09-05T14:00:00+0100"
}
```

- **Self-notes ignored** (`from == to` → no-op / marked skipped).
- No punish path from `dispute` / `NACK` — those verbs do not touch this store.
- Free-text + tags only; no numeric reputation field.

## Bus verbs

| Verb | Effect |
|------|--------|
| `ask_help` | Feed line + optional soft seek (tags); does not write self-praise |
| `commend` | Feed line + append/update peer note (`from→to`) |

Rate-limit: identical `commend` digests (same from/to/tags body) are soft-deduped via desk feed dedupe; store also skips exact duplicate within 5 minutes.

## Soft prior (never starve)

When choosing a helper / ordering refer targets:

1. Specialty match (existing lanes)
2. Peer `will_help` ∩ task tags (`agent_roles.json`)
3. Recent qualitative notes (recency; no KPI blend)
4. Else RR / lead assign

`pick_tasks` keeps fair RR as primary; helper ranking is a **soft** secondary prior and must not drop juniors or academy teaching lanes.

## KPI wall

This package must **not** import or write:

- `desk_metrics`
- `status/desk-lab-progress.json`
- fund / ship_live counters

Unit test `test_desk_reputation.py` enforces the wall via source scan + behavioral checks.

## Module

`store.py` — load/save, `write_note`, `commend`, `ask_help`, `rank_helpers`.
