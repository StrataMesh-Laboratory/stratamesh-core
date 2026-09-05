# RCA — automation desk agents audit (2026-09-05 PT)

Object: **desk agents’ work only** (Hermes, OpenCode, OpenClaw, fog-assistant, edge-assistant, STRATAGROK). No Fog `/health` version work in this stream.

## Evidence (André TUI 10:31 PT + origin state)

| Signal | Verified |
|--------|----------|
| DESK feed: openclaw `audit` hops | Real — `handler_claw` + meters |
| DESK feed: hermes/fog `act` | Real — coord/fog handlers + briefs |
| DESK feed: edge `dispute api=0 site=0 \| 429/1015` | Real agent-side — CF rate limit |
| DESK feed: stratagrok escalate vault / Oracle | Mixed — vault was over-escalated to André; Oracle is true `escalate_to_andre` |
| Unit tests desk-collegium | Real PASS after patches |
| `gh_unavailable` on ship/actions | Soft-fail present; representative (not André) |

## Pass/fail per agent

| Agent | Specialty | Claimed | Verifiable | Verdict | Notes |
|-------|-----------|---------|------------|---------|-------|
| **OpenClaw** | claw | hop audit | Feed + `desk-meters/openclaw.json` + unittest | **PASS** | Real probes; verb=`audit` |
| **OpenCode** | code | unit tests | Was vapour stamp in self-audit; now discover subset | **PASS (fixed)** | Idle starvation fixed via RR pick + `--max 3` + brief consume |
| **Hermes** | coord | board/protocol/teach | Cycle runs `handler_coord`; taper docs present | **PASS** | T1 WG brief outbox; teach duty runs |
| **fog-assistant** | fog | origin brief | `fog-assistant-next.md` from handler | **PASS** | Brief non-empty; consume via agent-run |
| **edge-assistant** | edge | health audit | Dispute on 429/1015 was dead-end | **PASS (fixed)** | Backoff retries + dispute→revise→call_vote chain |
| **STRATAGROK** | lead | escalate gates | Over-dumped representable work on André | **PASS (fixed)** | `escalate_to_andre` vs `resolve_as_representative` |

## Failures → collegial solve (landed)

1. **Edge 429/1015** — `_http_ok` backoff; `handler_edge` dispute + `next_action`; `apply_result` forces revise + call_vote (not feed-only).
2. **OpenCode idle / vapour** — self-audit runs real unittest (nest-safe); fair RR pick; `desk-agent-run.sh --max 3` + consume `opencode-next.md`.
3. **Vault gate** — desk cycle materializes from KeePass/`secrets.env`/sibling 0600 (never empty stubs). Bot representative only if escalated; André only if sources absent entirely.
4. **Oracle** — remains `escalate_to_andre` (password/reset).
5. **gh PATH** — representative act (connectors soft-fail); not André.
6. **Protocol** — `human_gates` law + `agent_roles.stratagrok` split `escalate_to_andre` / `resolve_as_representative`.

## Remaining true André human_gates

- Fog TUI **g** when required  
- **2FA** / **captcha**  
- **Oracle** vault password/reset  
- **Renovate majors** André must review  
- automation.desk secrets **missing entirely** after desk-cycle materialize (Bot representative only if that gate escalates)  

## SHAs / next

Land this patch on origin main; Mac agents pick up via g / agent-run. Cycle should show verb chains in diaries (`propose→constrain→act|dispute→revise→call_vote→…`).
