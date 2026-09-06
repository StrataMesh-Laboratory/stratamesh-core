# Hermes Ollama models — metabol_pace

Official Hermes needs **≥64K context** and **tool calling** for agent init.
Docs: [Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop), [CLI](https://hermes-agent.nousresearch.com/docs/reference/cli-commands), [Fallback providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/fallback-providers).

## Roster (OSS / free local)

| Model | Role | Context | Tools | Size | metabol_pace |
|-------|------|---------|-------|------|--------------|
| `llama3.2:1b` | **primary** | 131072 | yes | ~1.3GB | **light** host_cap — ALLOW default |
| `qwen2.5:3b` | fallback / complement | ≥64K | yes | ~1.9GB | **medium** — failover; STASIS sooner under RAM pressure |
| `qwen2.5:7b` | fallback heavy | ≥64K | yes | ~4.7GB | **heavy** — deep coding only; HOLD when host pressure |

Not used as primary: `mistral:latest` (32K < min), `phi3:latest` (131K but no tools).

## Config

- Primary: `model.default: llama3.2:1b` + `model.context_length: 131072`
- Fallback chain: `fallback_providers` → `qwen2.5:3b` then `qwen2.5:7b` (same `ollama-launch`)
- Discovery: `desktop.repo_scan_roots` (not raw `projects.db`)
- Workspace: `hermes desktop --cwd …/fog/repo` / `HERMES_DESKTOP_CWD`

## Desk wiring

`ops/desk-collegium/desk_metabol.py` platforms:
- `ollama-llama32-1b` (primary)
- `ollama-qwen25-3b` / `ollama-qwen25-7b` (complementary paces)

Lane `lane-hermes` lists primary + fallbacks. HOLD/STASIS = pace, not freeze.
