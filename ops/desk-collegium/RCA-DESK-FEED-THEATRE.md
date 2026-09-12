# RCA — Desk feed theatre loop (2026-09-12)

## Symptom (André)
TUI DESK log repeats: GHA `audit success` bursts, `surfaces … ok` stamped as Act,
self-audit queue lines, then soft-fail `refer`/`revise`/`call_vote` on the same
task (e.g. GCP e2micro / Oracle) with **no tool Act**. Looks busy; delivered≈0.

## Not the bug
Individual noisy lines (GHA success, surfaces ok, GCP vote). Those are **symptoms**.

## Root cause
**r/60s `cmd_cycle` has no Prep/Act separation.** Every Fog TUI refresh:

1. Always runs PREP: `ensure_desk_surfaces(feed=True)`, `desk_actions.cmd_sync`,
   `specialty_self_audit_tick` (fog/edge handlers + "specialists tasked").
2. PREP emits feed verbs (`act`/`audit`) even when nothing specialty-ran.
3. Soft-refer tasks stay **ongoing** and re-enter RR `pick_tasks` every tick.
4. `apply_result` → `collegium_continue_after_soft_fail` always `revise`+`call_vote`
   when `peer_vote`/refer — even if `next_action` is unchanged (standing HOLD).
5. Side bug: TUI calls `desk-agent-run.sh all` (invalid agent → usage/exit 2)
   after cycle already ran handlers — serialize comment ignored.

Net: feed proves "we checked" forever; NO-FAKE-DONE correctly disputes fake
Hermes done, but the **loop itself** is the product bug.

## Law touchpoints
- `NO-FAKE-DONE.md` — skip/queue/audit ≠ Act
- Feed rate-limit / delta-only (André desk feed rules)
- Serialize specialists on 8GB (never stack via `all`)

## Fix (this change)
| Layer | Change |
|-------|--------|
| GHA sync | Feed **failures only**; green runs stay meters |
| Surfaces | `kind=audit` + 1h dedupe; never `kind=act` for ok |
| Soft-refer | `skip_soft_fail_chain`; park pick for cooldown when standing |
| Fog TUI | Remove `desk-agent-run.sh all` from r/60s path |

## Prove
- One r/60s cycle: no new GHA success lines; no surfaces Act; Oracle/GCP not
  revise/vote-spammed; feed only moves on real specialty evidence or failure.
