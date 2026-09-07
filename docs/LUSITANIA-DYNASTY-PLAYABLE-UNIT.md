# Lusitania — Playable unit = gens (design doctrine)

**Status:** Normative player/design doctrine (2026-09-07)  
**Related:** [`LUSITANIA-PLAYER-REPORT.md`](./LUSITANIA-PLAYER-REPORT.md) · [`LUSITANIA-NOMENCLATURE.md`](./LUSITANIA-NOMENCLATURE.md) · [`OLISSIPPO-ENGINE-ARCHITECTURE.md`](./OLISSIPPO-ENGINE-ARCHITECTURE.md) · `src/olissippo_dynasty_clock.py`

## Semantic map (normative)

| Term | Meaning |
|------|---------|
| **gens** (pl. *gentes*) | Playable dynasty / house. Primary product & lore term. |
| **populus** (pl. *populi*) | All gentes of the same tribe. |
| **Lusitani** | Tribal confederation: all populi of Lusitanian culture. |

Internal aliases only: `stirps`, `dynasty` / `player_dynasty_*` (legacy code paths). New fields and player copy prefer `gens` / `gens_id` / `populus_id` / `confederation=lusitani`.

## Thesis

The avatar is temporary. The **gens** is the persistent character. Continuity across death is the core survival system; **gens extinction** is true game-over for that player line.

## Binary on death

| Outcome | Condition | Player experience |
|---------|-----------|-------------------|
| Gens continues | Valid succession under that gens’s law; unique-head (per-gens) satisfied | Transition into heir; inherit stakes + history; new agency |
| Game over | No valid successor / end of line | **Gens extinction**; restart |

Unprepared death ≠ death. Only the former is failure.

## Clock

`1 real day ≈ 1 game month` (`clock.real_day_equals_game_months`). Civilisation continues while you are away. Absentee / steward delegation produces momentum, not pure punishment. Steward does **not** invent heirs.

## Constitutional succession

Per-gens `succession_law` (stored also as `player_dynasties[].succession_law` for compat), mutable via Grove Lex / Nomic. Laws accumulate as constitutional history with event reasons. Elective: plurality of `succession_votes`; tie → eldest among tied.

## Continuity capacity

Optimize toward continuity, not avatar immortality. Clear heirs + stable law can dominate raw STRATA wealth without succession. On succession, inherit first-class edges: `enemy_of`, `owes_obligation_to`, `owed_by`. Alliance `oath_kin` stays gens-level.

## Subjects

ACB (EN) = SCA (PT). Human and ACB owners both form player gentes; no shared living head across two player gentes.

## Implementation pointers (lab)

- Aging / succession tick: `olissippo_dynasty_clock.advance_game_month`
- Unique head (per-gens): `assert_unique_dynasty_head` / `assert_unique_gens_head`
- Per-gens law: `set_dynasty_succession_law` / `set_gens_succession_law`
- Elective: `cast_succession_vote`, `resolve_elective`
- Inherit: `add_enemy`, `add_obligation`, `inherit_political_edges`
- Absentee: `declare_absentee`, `return_from_absentee`, `steward_may_act`
- Extinction signal: `extinctions` / `game_over_dynasties` (+ gens aliases) when no heir

## Distinguisher vs Main Open World

Main asks *what can you create?*  
Lusitania asks *what survives you?*
