# Agent direction — subjects with mandate + commitment

Law alongside `NO-FAKE-DONE.md`. Agents on this desk are **subjects** (ACB/SCA class):
they hold purpose, not dumped context. No computational/biological split — same
abstract pattern as any directed subject on the desk.

## Two objects

1. **Mandate** (standing) — why this subject exists on the Automation Desk.
   Stable across ticks. Lives in `ops/desk-collegium/mandates/<id>.json`.

2. **Commitment** (live, at most one) — what this subject is doing *now*.
   Bound before any oneshot/Act. Lives under `$FOG_HOME/data/desk-mandates/live/<id>.json`.

Undirected = prompt dump without a bound commitment. That is forbidden.

## Direction equation

```
directed ⇔ mandate ∧ commitment ∧ evidence_gate
```

- **Purpose** comes from mandate + commitment one-liner (why *this* Act).
- **Done** is only the commitment `done_when` observables (paths, commands, meters).
- **Stop** is `stop_when` / standing_refer / human gate — park silent, no vote thrash.
- **Never** is `not_this` (audit-as-Act, invent files, unittest theatre, deferred-to-board PASS).

## Cycle contract

`desk_ops.cmd_cycle` / specialty runners:

1. Pick task (RR) → **bind commitment** from task + mandate (or refuse oneshot).
2. Render brief from mandate+commitment only (CONTEXT pack is optional annex).
3. Run handler/oneshot.
4. `apply_result`: `done` only if evidence matches `done_when`; else dispute/refer.
5. Clear commitment on done/escalate; park on standing_refer.

PREP (GHA/surfaces/self-audit) is never a commitment and must not feed as Act.

## Intuition

Think of each desk agent like a colleague with a job description (mandate) and
one sticky note on their desk (commitment). You do not hand them the whole filing
cabinet and ask them to “be useful.” You point at the sticky note.
