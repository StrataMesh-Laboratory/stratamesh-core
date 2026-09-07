# Hermes context honesty (metabol)

## Law
Config aspiration ≠ live ctx. Desk Acts must cite `ollama ps` / Modelfile prove, not only Hermes `ollama_num_ctx` or `contextWindow` fields.

## 2026-09-07 prove (Mac FOG Intel 8GB)
| Claim | Result |
| --- | --- |
| Config wants 65536 / `qwen2.5:3b-64k` | Model **missing** — do not pull under RAM pressure |
| Create `llama3.2:1b-64k` Modelfile `num_ctx 65536` | Create OK |
| Generate smoke @64k | **TIMEOUT 180s** → meter `ok: HOLD` |
| Interim `llama3.2:1b-16k` @16384 | **PASS** |
| Live default at prove time | `llama3.2:1b` @4096 in Hermes default |

Meter: `FOG/data/desk-meters/hermes-64k.json`

## Do
- Prefer interim 16k primary until 64k generate is clean under host_cap
- Write meters with `ok` ∈ {PASS, HOLD, PARTIAL} only
- Teach apprentices: always `curl -s localhost:11434/api/ps` before claiming ctx

## Do not
- Switch Hermes primary to a 64k Modelfile that OOMs/times out
- Block the desk RR cycle waiting on a 64k pull
- Invent wrappers mid-flight when Ollama already reports live context_length
