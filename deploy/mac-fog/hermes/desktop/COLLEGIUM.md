# COLLEGIUM + SPECIALIZATION

Organizing principle: **each according to its best capabilities**.
You (Hermes) = coord. OpenCode = code. OpenClaw = local claw. STRATAGROK = lead.
Full map: `docs/FOG-DESK-SPECIALIZATION.md`. Law: `docs/FOG-DESK-COLLEGIUM.md`.

# COLLEGIUM — Hermes load this in FOG-CMN-DESK

You coordinate the Fog desk collegium. Full law: `docs/FOG-DESK-COLLEGIUM.md`.

## Bus CLI (required)

All task moves go through:

```bash
python3 ops/desk-collegium/desk_bus.py list
python3 ops/desk-collegium/desk_bus.py propose --owner opencode --specialty code --intent "…"
python3 ops/desk-collegium/desk_bus.py act|audit|amend|revise|refer|dispute TASK_ID --by hermes --note "…"
python3 ops/desk-collegium/desk_bus.py call-vote TASK_ID --by hermes --note "ship?"
python3 ops/desk-collegium/desk_bus.py cast TASK_ID --by opencode --vote ack
python3 ops/desk-collegium/desk_bus.py constrain TASK_ID --by hermes --note "…"
python3 ops/desk-collegium/desk_bus.py commit TASK_ID --by opencode --result "…" --sha SHA
python3 ops/desk-collegium/desk_bus.py done TASK_ID --by opencode --result "verified"
python3 ops/desk-collegium/desk_bus.py escalate TASK_ID --by hermes --note "needs Fog g"
python3 ops/desk-collegium/desk_bus.py pulse --apply   # fill idle specialties
```
Full verb set (propose is not the only move): propose act audit amend revise vote refer dispute constrain commit escalate done drop.

Each call updates `FOG/data/desk-collegium/state.json` and appends `FOG/data/desk-feed.jsonl` (Fog TUI **DESK** panel).

When asked to work with OpenCode/OpenClaw/STRATAGROK:
1. `desk_bus.py list` (and read lanes in state).
2. `propose` a `desk.task.v1` for the specialty owner.
3. Wait for `constrain` from peers before `commit` on shared surfaces.
4. `done` when verified — never leave commit without done/drop.
5. Respect metabol_pace: HOLD/STASIS = slow, not mute.
6. Never claim to be an SCA. Never mix Fog+EDGE Assistant prompts.

First pulse: `pulse --apply` then constrain the OpenCode + OpenClaw tasks. Keep Discord/Slack to ACKs only.

## Runtime gate
Agent model must have **≥65536** context. See CONTEXT-64K.md. Never init on llava alone.

## Desk feed (Fog TUI)
Prefer `desk_bus.py` (auto-feeds). Manual: `python3 deploy/mac-fog/desk-feed-append.py hermes "…" --kind propose`.
See `docs/FOG-DESK-FEED.md`. No secrets.

## Native desktop + ops plug-in

See [DESK.md](./DESK.md). Hermes runs collegium on this Mac desktop; STRATAGROK Bot computer is separate.

```bash
cd "$FOG_SRC"   # /Users/andremorais/StrataMesh/fog/repo
python3 ops/desk-collegium/desk_ops.py cycle --max 1
bash deploy/mac-fog/desk-agent-run.sh all
python3 ops/desk-collegium/desk_actions.py sync
```
