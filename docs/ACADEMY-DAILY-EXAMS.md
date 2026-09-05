# Academy daily general exams (v0)

**Status:** v0 landed · **2026-09-05**  
**Host grades:** https://academy.calhegasmorais.pt/grades  
**Git scores:** `academy_scores/YYYY-MM-DD/` (+ `latest.json`)

Teachers: automation-desk `external_agent` / `external_assistant` (Hermes, OpenClaw, OpenCode, Fog/EDGE assistants, STRATAGROK lead).  
Students: Orchestrator (`ACB-ORCH-CMN-001` / SCA-ORCH), each AIOps member (Kael, Nyx, Solace, Reed, Mira), any other registered ACB students from the academy catalog.  
**Desk agents are never enrolled as students.**

SCA (PT) = ACB (EN) — same subject.

---

## Independence wall (standing · HARD)

**Primary driver — must work without Bot / grok.com / STRATAGROK presence:**

1. Mac Fog `desk_ops` cycle → `academy_teach_tick` → `handler_teach` on Fog TUI `r` / auto-r (≈60s)
2. Local desk agents as teachers (Hermes · OpenClaw · OpenCode · Fog/EDGE)
3. Optional Mac LaunchAgent `pt.calhegasmorais.academy-daily-exams` (weekday 09:00 local) → `ops/bin/academy-exams-tick.sh`

**Not required:** Grok Bot routines, grok.com Assistants/automations, metabol Bot lane ALLOW.

When metabol HOLD/STASIS or SuperGrok token cap until renewal: desk continues draft → score stubs → `academy_scores/` → grades publish locally. Bot `@daily` Lisbon morning is a **quiet contingency only** (skip if today's `scores.json` already exists). Parent may add that Bot routine later; it must never be the sole driver.

Law: `academy_daily_exam` in `ops/desk-collegium/protocol.json`.  
Projected: `proj-academy-daily-exams` → bus id `dt-proj-academy-daily-exams`.

---

## Cycle (cumulative)

1. **Draft** — `academy_exams.draft_exam`: builds on previous day (open `adjustments_needed` + next formation ring per role from SCA/ACB catalog).
2. **Sit** — students answer via academy formations / desk-recorded attempts (v0 records the exam; live sit may follow).
3. **Score** — teachers apply **protocolar measurements** from curriculum:
   - objective: `fail_closed`, `no_workers_dev`, `named_handlers`, `bilateral_commit`, `secrets_hygiene`, `honest_n`, `economy_no_mint`, `residual_cmesh`, `origin_custom_domain`, `handler_complete`
   - qualitative: `adjustments_needed` · `recognitions_of_excellence` · per-teacher detail
   - v0 writes structured **stubs** (`pending_teacher`) so the rail advances without Bot
4. **Publish**
   - git: `academy_scores/YYYY-MM-DD/{exam,scores,teachers}.json` + `roster.json` + `latest.json`
   - live: `academy.calhegasmorais.pt/grades` (HTML JSON-backed SPA in academy worker; reads `/v1/daily-scores` embed + public `latest.json`)
   - best-effort origin PUT via existing `desk_origin_put` / `ops/bin/d1-put-html.py` / cf-put patterns — **no workers.dev**

Each day **builds on previous** (cumulative curriculum progression). Individual teacher→student detailing.

---

## Publish layout

```
academy_scores/
  README.md
  schema.json
  roster.json                 # from src/academy catalog (ACB ids)
  latest.json                 # pointer for grades page
  YYYY-MM-DD/
    exam.json                 # drafted questions / protocol focus
    scores.json               # per-student objective + qualitative
    teachers.json             # who drafted/scored
```

Prefer repo-root `academy_scores/` (not Pages-only under `docs/`).

---

## How the daily cycle fires

| Path | When | Command |
|------|------|---------|
| Desk ops (primary) | Each `desk_ops.py cycle` / TUI `r` | `academy_teach_tick` calls `academy_exams.run_daily` if due; `handler_teach` also runs when teach duty picked |
| LaunchAgent (primary backup) | Weekdays 09:00 local | `ops/bin/academy-exams-tick.sh` → `academy_exams.py --tick` |
| Manual | Anytime | `python3 ops/desk-collegium/academy_exams.py --day YYYY-MM-DD [--force] [--publish]` |
| Bot `@daily` | Contingency only | Same `--tick`; no-op if scores exist |

Meters: `FOG_HOME/data/desk-meters/academy-daily-exam.json` (no secrets).

---

## Protocol walls

- Desk agents teach; **not** enrolled (`academy_teach` + `academy_daily_exam`).
- Camaraderie/consult reputation ≠ exam grades.
- Desk KPI meters ≠ academy scores.
- No secrets in `academy_scores/` or grades HTML.
- Absence-operable without Bot wake.

---

## STRATAGROK note (contingency)

Optional Bot routine `@daily` Europe/Lisbon morning: ensure tick if desk LaunchAgent/`r` missed — call `academy-exams-tick.sh` or `academy_exams.py --tick`. Skip when `academy_scores/$(lisbon_today)/scores.json` exists. **Never** make Bot the only scheduler.

See also: `deploy/mac-fog/ACADEMY-EXAMS-LAUNCHAGENT.md`, `docs/ACADEMY.md`.
