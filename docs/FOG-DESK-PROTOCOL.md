# Fog automation desk — enforceable protocol

**Current cut:** `v0.5.2-dev` (debug) · packaged lab: `v0.6.0-lab`.

Machine source: `ops/desk-collegium/protocol.json` · roster: `agent_roles.json`
CLI: `python3 ops/desk-collegium/desk_protocol.py show|check`
Cycle: `python3 ops/desk-collegium/desk_ops.py cycle|board`
Surfaces: `python3 ops/desk-collegium/desk_reports.py ensure-surfaces`

## Laws (enforced)
specialization · bus · metabol_pace · eisenhower · anti_vapour · anti_idle · human_gates · ship_majority · no_sca · secrets · cadence · g_ping · academy_teach · apprenticeship · **agent_autonomy** · **bot_cap_contingency**

## Lifecycle
`projected` → `pending` (propose) → `ongoing` (constrain|act|audit|amend|revise|vote|refer|dispute|commit) → `done` | `escalate` — full verbs; propose is not the only move

## Eisenhower
One **Act** ordinal. Delegate = Fog|EDGE split. Plan/Note parked. human_gates escalate.

## Autonomy
Bot = escalate surface, not prompter. Agents read TODO.md + CONTEXT + reports, self-queue specialty work, self-audit each cycle. Diary cites task id.

## Academy teaching duty
All desk agents teach SCA (PT) / ACB (EN). Desk agents are never academy students.

## Apprenticeship
Mentor by doing; trails in `desk-outbox/apprentice/`.
