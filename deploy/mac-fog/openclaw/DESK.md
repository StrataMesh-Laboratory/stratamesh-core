# OpenClaw desk environment

Native Mac specialty seat for **claw/probes**. Not Bot desktop.

## Paths (Mac)
| What | Path |
|------|------|
| Fog repo | `$FOG_SRC` = `/Users/andremorais/StrataMesh/fog/repo` |
| Outbox | `$FOG_HOME/data/desk-outbox/` |
| TODO board | `$FOG_HOME/data/desk-outbox/TODO.md` |
| CONTEXT pack | `$FOG_HOME/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md` |
| Reports | `$FOG_HOME/data/desk-outbox/reports/` |
| Journals | `$FOG_HOME/data/desk-outbox/journals/<agent>/` |
| Meters | `$FOG_HOME/data/desk-meters/` |

## Mandatory wake order
1. `$FOG_HOME/data/desk-outbox/CONTEXT-CMN-STRATAMESH.md` (shared CMN+StrataMesh pack)
2. `ops/desk-collegium/protocol.json` (laws incl. agent_autonomy, bot_cap_contingency)
3. Eisenhower: `docs/FOG-DESK-PROTOCOL.md` + `docs/FOG-DESK-OPS.md` — **one Act**; Plan/Note parked
4. Live TODO board: `desk-outbox/TODO.md` (pick only your specialty; human_gates escalate)
5. Reports: `desk-outbox/reports/latest.md` (GH Actions + Discourse)
6. Specialty self-audit + self-queue from board/projected — **Bot = escalate surface, not prompter**


Surfaces are **cycle-owned** (`ensure_desk_surfaces` on every TUI `r`/60s). Bot never required to regenerate.


```bash
bash deploy/mac-fog/desk-agent-run.sh openclaw
# read TODO.md — pick specialty=claw only
```
