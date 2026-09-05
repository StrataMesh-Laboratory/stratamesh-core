# Specialization — organizing principle of the Fog desk collegium

**Law:** each member acts **according to its best capabilities**. Overlap is constrained; ownership is exclusive for the specialty core. Parallel work is default when specialties are disjoint.

This amends [FOG-DESK-COLLEGIUM.md](./FOG-DESK-COLLEGIUM.md). If a task fits two agents, the **primary specialty owner** proposes; the other only constrains.

## Specialty map (exclusive core)

| Agent | Best at (owns) | Does not own | Hands off to |
|-------|----------------|--------------|--------------|
| **STRATAGROK** (`grok@`) | Eisenhower rank, meters, Git Data API lead, **escalation surface** (not routine prompter), multi-surface facts | Local Mac GUI click-storms, Fog TUI `g`, routine next-step prompts | André (`g`/2FA); agents self-queue |
| **Hermes** | Collegium bus, desk coordination, wizard FAQ, messaging orchestration, propose/constrain cadence | Large code patches, CF Worker deploy, origin-take | OpenCode (code); OpenClaw (local loops); STRATAGROK (git lead) |
| **OpenCode** | Code/tests/refactors in-repo, failing-test fix, patch review drafts | Channel fan-out, metabol decide(), Mac `g` | STRATAGROK/Fog Assistant to land git+live; Hermes for bus |
| **OpenClaw** | Local automation loops, ws tooling, machine-side claw tasks on Fog Mac | Protocol design, Assistant prompts, public Discourse | Hermes (coord); OpenCode (if code change needed) |
| **CMN FOG ASSISTANT** | Fog/core **git+live**: hops, Pages HTML, auth/mw (one Act; self-queue when idle) | EDGE thread, Bot multitask | Self-queue from projected/bus; Bot feeds only if empty AND no self-queue |
| **CMN EDGE ASSISTANT** | EDGE **GET consume-only** (one Act; self-queue GETs) | Fog/core write / origin-take | Self-queue; Bot feeds only if empty AND no self-queue |
| **André** | Human gates: Fog TUI `g`/`s`/`b`, 2FA, captcha, Renovate majors on invariants, Oracle password | Routine desk loops | Desk after gate |

## Routing rule

1. Classify task by **primary specialty** (one owner).
2. Owner **proposes** `desk.task.v1` with that specialty.
3. Others **constrain** only if their lane/meters or deny-list is touched.
4. Commit stays with owner (or named handoff).
5. Never reassign specialty mid-flight without escalate.

## Parallelism (specialization enables it)

OK together: Hermes bus pulse + OpenCode patch + OpenClaw local probe + Fog Assistant Act + EDGE Assistant Act (split threads).
Not OK: two code owners on one file; two leads Eisenhower-ranking the same Act; Hermes writing Worker deploys.

## metabol_pace still binds

Specialization does not bypass lanes. If `lane-opencode` is STASIS, OpenCode slows — Hermes may still coordinate; STRATAGROK may still rank. Pace ≠ freeze.


## Autonomy amendment
See [FOG-DESK-AUTONOMY.md](./FOG-DESK-AUTONOMY.md). Agents self-initiate + self-audit; STRATAGROK escalates only.
