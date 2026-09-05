# Academy daily general exams

**Status:** Act in progress (v0) · **2026-09-05**  
**Teachers:** automation-desk `external_assistant`s (never students).  
**Students:** Orchestrator ACB, AIOps team members, other registered ACB students.

## Cycle

1. **Draft** (desk) — exam builds on previous day’s curriculum + open adjustments  
2. **Sit** — students answer via academy surface / desk-recorded attempts  
3. **Score** — teachers apply protocolar SCA/ACB measurements:  
   - objective metrics (protocol invariants, task completion, mesh hygiene)  
   - qualitative: adjustments needed · recognitions of excellence  
   - individual teacher→student detail  
4. **Publish** — `academy_scores/YYYY-MM-DD/` in git + `academy.calhegasmorais.pt/grades`

## Publish layout

```
academy_scores/
  README.md
  roster.json                 # registered students (ACB ids)
  YYYY-MM-DD/
    exam.json                 # drafted questions / protocol focus
    scores.json               # per-student objective + qualitative
    teachers.json             # who drafted/scored
  latest.json                 # pointer for grades page
```

## Protocol wall

- Desk agents teach; they are **not** enrolled.  
- Camaraderie/consult reputation ≠ exam grades (separate).  
- KPI desk meters ≠ academy scores (separate).  
- Absence-operable: `academy_teach_tick` / daily routine must advance the cycle.

## EN/PT

ACB = SCA (same subject). EN copy uses ACB; PT uses SCA.


## Independence / metabol cap (standing)

**Primary driver (must work without Bot):**

1. Mac Fog `desk_ops` / `academy_teach_tick` on the 60s `r`/auto-r loop
2. Local desk agents (Hermes · OpenClaw · OpenCode · Fog/EDGE) as teachers
3. Optional Mac LaunchAgent `pt.calhegasmorais.academy-daily-exams` (Lisbon morning) calling `ops/bin/academy-exams-tick.sh`

**Not required:** STRATAGROK presence, Grok Bot routines, grok.com Assistants/automations.

When metabol HOLD/STASIS or Bot/SuperGrok token cap: desk continues the draft→score→`academy_scores/`→grades publish locally. Bot routine is a **quiet backup** only (skip if today's scores already exist).

