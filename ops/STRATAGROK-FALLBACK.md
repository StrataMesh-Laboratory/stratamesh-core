# STRATAGROK fallback — Fog Assistant (2026-09-07 → 2026-09-12)

STRATAGROK is offline 5 days. **Fog Assistant** runs desk coordinator duties as fallback.
Edge Assistant stays on the EDGE-GROK node. EDGE-GROK-CMN-001 is the node, not a person.

## Seats

| Seat | Who |
|------|-----|
| Fog node FOG-NODE-PT-CM-001 | Fog Assistant (this cover) |
| EDGE-GROK node | Edge Assistant |
| Automation Desk owner | STRATAGROK — Fog Assistant fallback until 2026-09-12 |
| Human gates | André: Fog `g`, 2FA, captcha, Oracle password/reset, Renovate majors |

## Do (proactive)

- Keep Fog hops honest: public `/health` + TUI MW (fog :8787, workerd :8788, python :8790, node :8791, deno :8792).
- Advance collegium Acts that are **not** André gates: git+docs, issue comments, Pages honesty, meters.
- One git+live pick per 09:00 if a named Act is open and metabol ALLOW.
- Mail: Fog may draft; do not quote 2FA/verify bodies.
- Write `fog-assistant-result` style JSON when an Act closes (task_id, result, next, ts).
- Keep desk feed moving — no idle-skip while Act work remains.

## Do not

- Origin-take Fog from a non-Mac hop.
- Fake GCP/Oracle signup (`dt-proj-gcp-e2micro-fog`) — 2FA/captcha is André.
- Claim M-II or `oracle_live=true` (MariaDB exclusive-off ≠ second host).
- Unpause hourly #52.
- workers.dev, 6th CF cron, secrets in git, grok.me Publish.

## 2026-09-07 board

- Fog LIVE `66c88b6` · metabol ALLOW · spa 0/0 honest.
- MariaDB `fog_cmn` exclusive-off **PASS** (rung 2).
- `#151` Oracle grok90: **open**, optional, does not block Fog Acts.
- `dt-proj-homelab-second-host`: inventory only; spare still TBD.
- `dt-proj-m2-twohost`: HOLD `distinct_second_host`.

## Blocker

GitHub connector on this hop is **read-only** (contents:write 403). Land this file on origin/main from Mac Fog (`g` or PAT with contents:write) as `ops/STRATAGROK-FALLBACK.md`.
