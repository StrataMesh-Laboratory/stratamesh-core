# OpenClaw — FOG external_agent

**Role:** external_agent · **Specialty:** claw · **Lane:** lane-openclaw
**Id:** openclaw@fog.calhegasmorais.pt · **Soul/Desk:** `deploy/mac-fog/openclaw/{SOUL,DESK}.md`

Self-queue claw probes from TODO.md; self-audit hops each run → meters/openclaw.json.
Wake order + CONTEXT pack mandatory. Bot = escalate only. Not SCA/ACB.

## Desk8k primary (8GB Mac Fog)

- **Model:** `ollama/qwen2.5:3b-desk8k` (Modelfile `num_ctx 8192`)
- **Exec:** `openclaw agent exec … --local-model-lean --code-mode direct --timeout 900 --json` with stdin `/dev/null`
- **Serialize:** never stack Hermes + OpenClaw + OpenCode on one Ollama slot (`deploy/mac-fog/desk-agent-run.sh`)

## Timeout after tool-search — ONE docs-backed path (OpenClaw 2026.9.1+)

Symptom: catalog/tool-search then hang or exit timeout while direct `ollama` / `openclaw infer` still work.

| Knob | Value | Why |
| --- | --- | --- |
| `models.providers.ollama.timeoutSeconds` | `900` | Provider HTTP **and** model stream idle watchdog on 2026.9.x ([#77744](https://github.com/openclaw/openclaw/issues/77744) / [#83979](https://github.com/openclaw/openclaw/pull/83979); [docs/providers/ollama](https://docs.openclaw.ai/providers/ollama.md)) |
| `agents.defaults.timeoutSeconds` | `900` | Overall agent turn / CLI `--timeout` |
| `experimental.localModelLean` | `true` | Smaller tool surface |
| `tools.toolSearch` | `false` | Desk8k: opt out of lean auto Tool Search so `write`/`exec` schemas are direct (weak models fail `tool_call` bridge) |
| `baseUrl` | `http://127.0.0.1:11434` (**no `/v1`**) | Native tools; `/v1` breaks tool calling |

### Retired keys (do not write)

On OpenClaw **2026.9.1**, schema rejects / `doctor --fix` strips:

- `agents.defaults.llm` / `idleTimeoutSeconds` (legacy; migrated to provider `timeoutSeconds`)
- `agents.defaults.toolCallTimeoutSeconds` (not in this build’s defaults schema)

Writing them breaks `openclaw infer` / `agent exec` with `Config is invalid`.

Apply / verify:

```bash
python3 deploy/mac-fog/openclaw/ensure-desk8k-timeouts.py
python3 deploy/mac-fog/openclaw/ensure-desk8k-timeouts.py --check
openclaw config validate
# if legacy keys present: openclaw doctor --fix
```

Prove (Mac Fog, Ollama free, serialize — HOLD desk cycle):

```bash
openclaw infer model run --local --model ollama/qwen2.5:3b-desk8k --prompt 'Reply with exactly: pong' --json
openclaw agent exec 'Create status/openclaw-hop-prove.txt with exactly one line: desk8k-ok' \
  --cwd "$FOG_SRC" --model ollama/qwen2.5:3b-desk8k --local-model-lean --code-mode direct \
  --timeout 900 --json </dev/null
test -f "$FOG_SRC/status/openclaw-hop-prove.txt" && cat "$FOG_SRC/status/openclaw-hop-prove.txt"
```

### Tool Call blocked after tool-search (2026-09-07 evidence)

`agent exec` with `--cwd \$FOG_SRC` blocks writes outside that tree (`Tool Call blocked`). Asking for `\$FOG/data/desk-outbox/...` yields repeated `tool_call` failures then turn timeout — not an idle-watchdog miss when `models.providers.ollama.timeoutSeconds=900` is already set. Fix: prove path under `--cwd`, or point `--cwd` at a workspace that includes the outbox.

**Do not** invent mid-flight wrappers after this docs pass (skill: docs-forums-glitch-triage).
