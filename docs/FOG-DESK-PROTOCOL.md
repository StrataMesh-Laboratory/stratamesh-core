# Fog automation desk — enforceable protocol

**Current cut:** `v0.6.0-lab` (lab) · debug precursor: `v0.5.2-dev`.

Machine source: `ops/desk-collegium/protocol.json` · roster: `agent_roles.json`
CLI: `python3 ops/desk-collegium/desk_protocol.py show|check`
Cycle: `python3 ops/desk-collegium/desk_ops.py cycle|board`
Surfaces: `python3 ops/desk-collegium/desk_reports.py ensure-surfaces`

## Laws (enforced)
specialization · bus · metabol_pace · eisenhower · anti_vapour · anti_idle · human_gates · ship_majority · no_sca · secrets · cadence · g_ping · academy_teach · apprenticeship · **agent_autonomy** · **bot_cap_contingency**

## Lifecycle
`projected` → `pending` (propose) → `ongoing` (constrain|act|audit|amend|revise|vote|refer|dispute|commit) → `done` | `escalate` — full verbs; propose is not the only move

## Eisenhower
One **Act** ordinal. Delegate = Fog|EDGE split. Plan/Note parked. **escalate_to_andre** only: Fog g, 2FA, captcha, Renovate majors (Oracle optional; André only 2FA/captcha). Desk cycle owns routine vault materialize (KeePass→0600). Else STRATAGROK **resolve_as_representative** only when escalated (vault if desk failed / sources absent, gh PATH, edge 429, OpenCode idle, vapour fixes). After dispute: stratagrok act before André ping.

## Autonomy
Bot = escalate surface for true André gates; otherwise resolve_as_representative. Agents read TODO.md + CONTEXT + reports, self-queue specialty work, self-audit each cycle. Diary shows verb chains (not a single say).

## Academy teaching duty
All desk agents teach SCA (PT) / ACB (EN). Desk agents are never academy students.

## Apprenticeship
Mentor by doing; trails in `desk-outbox/apprentice/`.
