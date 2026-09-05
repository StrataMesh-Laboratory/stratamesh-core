# Autonomous Fog automation desk — operational loop

**Current cut:** `v0.5.2-dev` (debug) · packaged lab: `v0.6.0-lab`.

**Principle:** specialization + collegium bus + metabol_pace + **agent_autonomy**.
**Bot = escalate surface, not prompter.** Agents = self-initiative + self-audit.

## Agents
STRATAGROK (lead/escalate) · Hermes (coord) · OpenCode (code) · OpenClaw (claw) · Fog/EDGE Assistants (one Act; self-queue when idle).

## Executor (anti-vapour)
`desk_ops.py cycle` on Fog TUI `r`/60s:
metabol → **ensure_desk_surfaces** (journals/reports/TODO/CONTEXT) → roles_ok → projected → self_audit → pick ALLOW → handler → **auto_ship if majority+metrics** → academy_teach → /desk push.

## Self-initiative
- Hermes/OpenCode/OpenClaw: driven by TUI r / desk-agent-run / outbox — pull from TODO.md + bus
- Fog Assistant: may propose next Act in-thread when idle; Bot feeds only if empty AND no self-queue
- EDGE: consume-origin GET self-queue; no origin write

## Self-audits (each cycle)
| Agent | Audit |
|-------|-------|
| OpenClaw | hops (fog_public, :8787, edge) |
| OpenCode | tests / unittest stamp |
| Hermes | protocol.check + board |
| Fog | origin health |
| EDGE | consume-origin GETs |

## Escalate ONLY to STRATAGROK
human_gates (g/2FA/captcha/Oracle/Renovate majors) · ship NACK or OOB metrics · metabol STASIS (own lane) · secrets · protocol violations — **never routine next-steps**.

## Bot token-cap contingency (`bot_cap_contingency`)
When `lane-bot` HOLD/STASIS: Mac TUI + desk_ops + desk-agent-run **continue**; Fog Assistant if lane-assistant ALLOW; EDGE consume-only. On Bot wake: pull meters/outbox; escalate failures only.

## Ship auto-metrics
Majority ACK + in-band (desk_score≥70, protocol_ok, claw fog_public soft, no human_gate) → **auto-ship** without Bot. NACK/OOB → escalate Bot.

## Steady-state loop
```
every wake / Hermes pulse / TUI r:
  1. ensure_desk_surfaces (TODO/CONTEXT/reports/journals)
  2. Read CONTEXT → protocol → Eisenhower → TODO board → reports
  3. Self-audit specialty; self-queue ALLOW from board
  4. Disjoint specialties parallel
  5. auto_ship if majority+metrics
  6. Escalate only gates/NACK/OOB/secrets/violations
```

## Secrets vault
Full read+write to owned vault tokens per `ops/desk-collegium/SECRETS-VAULT.md`. Never print values. Bot escalate only if vault missing/corrupt/2FA.
