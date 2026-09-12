# Pending Ollama desk Acts — 2026-09-12 PT

Serialize via `deploy/mac-fog/desk-agent-run.sh` — one specialty per pulse.
NO-FAKE-DONE. No Tailscale seats. T3 catalog from **2026-09-14** (Plan only until that date).
`oracle_live=false`. Lanes hermes/openclaw/opencode ALLOW.

Older `dt-*-20260907` / unittest-as-Act rows are vapour. Do not revive.

## Review (feed honesty, origin `edee4bf` line)

| Path | Verdict |
|---|---|
| `honest_result` + `apply_result` | PASS — skip cannot be ok+done |
| `desk-agent-run.sh` + `desk_agent_finish.py` | PASS — binary_present removed |
| `fog-tui.py` chrome reject of `unittest discover pass` | PASS |
| `test_no_fake_done.py` | PASS |
| `desk-agent-contingency.sh` `run_fog_tools` | **was FAIL** — unittest discover stamped a meter; patched this Act |
| Handler dry-run `ok: True, done: False` | HOLD — not a feed PASS |
| T3 Tailscale down | Plan from 2026-09-14 — not today's Act |

## Hermes (`lane-hermes`) — `dt-hermes-lesson-20260912`

One SCA/ACB lesson at `desk-outbox/journals/hermes/` using **tools** (file write). Facts only:

- Fog origin=macbook LIVE; T1 WG Mac `10.88.0.2` PASS (`cab9a48` / hermes-wg)
- `oracle_live=false`
- Public `ollama.calhegasmorais.pt` = bearer 401 without token; desk stays `127.0.0.1:11434`
- T3 from 2026-09-14: Tailscale down, no paid seats; stack = WG + OpenVPN + named tunnel + Tor

Evidence: journal path + oneshot tool trace. `protocol.check` alone is not done.
Model: interim `llama3.2:1b` — do not pull 64k.

## OpenClaw (`lane-openclaw`) — `dt-claw-hops-20260912`

`deploy/mac-fog/desk-claw-probe.sh` (or `openclaw/desk-claw-probe.sh`). Desk8k only.

Evidence meter `desk-meters/openclaw.json`:

```json
{"ts":"ISO","fog_public":1,"edge_api":1,"local_8787":1,"ok":false}
```

`ok` becomes true only if the probe wrote that file and hops were actually curled. No GCP, no 2FA, no Tailscale buy.

## OpenCode (`lane-opencode`) — `dt-code-contingency-20260912`

Own the contingency honesty patch (unittest is CI). Next TODO.md **code** item only if that patch already on the Mac tree.

Evidence: file diff + `desk-meters/opencode-last.log` from `opencode run` on `opencode-next.md`. Unittest discover PASS is **not** evidence.

## Fog Assistant

Git + Pages honesty only. No TUI `g`. No workers.dev. No 6th cron.
After these three land evidence on the Mac, auto-g / RR pulse may `desk_agent_finish`.
