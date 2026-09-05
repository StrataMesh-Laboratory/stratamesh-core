# Fog automation desk agents (external_*)

**Current cut:** `v0.6.0-lab` (lab) · debug precursor: `v0.5.2-dev`.

**Single roster + pointer table.** Machine source: `ops/desk-collegium/agent_roles.json`.
None are SCA/ACB students — all teach/mentor.

| Id | Label | Role | Specialty | Lane | Soul / Desk | Docs |
|----|-------|------|-----------|------|-------------|------|
| stratagrok | STRATAGROK | external_assistant | lead | lane-bot | — | EDGE contract, SPECIALIZATION |
| hermes | Hermes | external_agent | coord | lane-hermes | `deploy/mac-fog/hermes/desktop/{SOUL,DESK}.md` | HERMES-FOG-AGENT.md |
| opencode | OpenCode | external_agent | code | lane-opencode | `deploy/mac-fog/opencode/{SOUL,DESK}.md` | OPENCODE-FOG-AGENT.md |
| openclaw | OpenClaw | external_agent | claw | lane-openclaw | `deploy/mac-fog/openclaw/{SOUL,DESK}.md` | OPENCLAW-FOG-AGENT.md |
| fog-assistant | CMN FOG ASSISTANT | external_assistant | fog | lane-assistant | Archive Instructions | NO-CALHEGAS-MORAIS-INSTRUCTIONS.md |
| edge-assistant | CMN EDGE ASSISTANT | external_assistant | edge | lane-assistant | Archive + EDGE prompt | CMN-EDGE-ASSISTANT-PROMPT.md |

Coordination: [FOG-DESK-COLLEGIUM.md](./FOG-DESK-COLLEGIUM.md) · autonomy: [FOG-DESK-AUTONOMY.md](./FOG-DESK-AUTONOMY.md) · `ops/desk-collegium/`.

## Laws (every agent)
- **agent_autonomy:** Bot = escalate surface; agents self-initiate + self-audit
- **bot_cap_contingency:** desk keeps working when lane-bot HOLD/STASIS
- **ship_majority:** auto-ship on majority + metrics in-band; NACK/OOB → Bot
- **academy_teach** + **apprenticeship**
- Wake: CONTEXT pack → protocol → Eisenhower → TODO.md → reports → specialty

## Cycle-owned surfaces (auto each TUI r)
`ensure_desk_surfaces()` → journals/ · reports/ · TODO.md · CONTEXT-CMN-STRATAMESH.md · meters/surfaces_ok.json
Bot never required to regenerate.

## Archive roles
- **Fog Assistant:** Fog **git+live** (origin, hops, auth/mw)
- **EDGE Assistant:** EDGE **GET consume-only** (no origin write / no Fog bind)

## Secrets vault
See `ops/desk-collegium/SECRETS-VAULT.md` + `ops/desk-collegium/agents/<id>/VAULT.md`. Full access; gitignored roots; never copy values into outbox.
