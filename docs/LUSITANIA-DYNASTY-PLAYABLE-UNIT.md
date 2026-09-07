# Lusitania — Playable unit = stirps (design doctrine)

**Status:** Normative player/design doctrine (2026-09-07)  
**Related:** [`LUSITANIA-PLAYER-REPORT.md`](./LUSITANIA-PLAYER-REPORT.md) · [`OLISSIPPO-ENGINE-ARCHITECTURE.md`](./OLISSIPPO-ENGINE-ARCHITECTURE.md) · `src/olissippo_dynasty_clock.py`

## Thesis

The avatar is temporary. The **stirps / player dynasty** is the persistent character. Continuity across death is the core survival system; extinction is true game-over.

## Binary on death

| Outcome | Condition | Player experience |
|---------|-----------|-------------------|
| Dynasty continues | Valid succession under that dynasty’s law; unique-head constraints satisfied | Transition into heir; inherit stakes + history; new agency |
| Game over | No valid successor / end of line | Extinction; restart |

Unprepared death ≠ death. Only the former is failure.

## Clock

`1 real day ≈ 1 game month` (`clock.real_day_equals_game_months`). Civilisation continues while you are away. Design absentee / delegation so this produces momentum, not pure punishment.

## Constitutional succession

Per-`player_dynasty` `succession_law`, mutable via Grove Lex / Nomic typed changes. Laws accumulate as **constitutional history** with event reasons (`law_version`, resolution reasons).

## Continuity capacity

Optimize toward continuity, not avatar immortality. Clear heirs + stable law can dominate raw STRATA wealth without succession.

## Subjects

ACB (EN) = SCA (PT). Human and ACB owners both form player dynasties; no shared living head across two player dynasties.

## Implementation pointers (lab)

- Aging / succession tick: `olissippo_dynasty_clock.advance_game_month`
- Unique head: `assert_unique_dynasty_head` / `shared_successor_forbidden`
- Per-dynasty law: `set_dynasty_succession_law` / HearthLaw policy
- **TODO:** explicit `dynasty_extinction` / player game-over signal when no heir; absentee/delegation verbs; richer elective succession; inheritance bundle of obligations/enemies as first-class edges

## Distinguisher vs Main Open World

Main asks *what can you create?*  
Lusitania asks *what survives you?*
