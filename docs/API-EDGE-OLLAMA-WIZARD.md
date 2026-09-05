# api-edge smart wizard — local native Ollama

**Act:** `dt-api-edge-ollama-wizard` · **Eisenhower:** Act · **TUI `?` wizard:** stays **PLAN** (separate).

## Non-negotiable: local Ollama only

| Rule | Meaning |
|------|---------|
| **Native Ollama** | Process on the **executing host** (Fog Mac, EDGE node, or api-edge local MW hop) listening at `http://127.0.0.1:11434` |
| **Never remote** | No cloud LLM, no public Ollama tunnel, no Bot/Grok as the wizard brain for these three flows |
| **api-edge role** | Contract + state machine + schemas (`/v1/wizard/*`). Cloudflare Worker **does not** call Ollama (Workers cannot reach host loopback) |
| **Who calls Ollama** | Local SDK on Fog/EDGE host (`ops/lib/ollama_local.py` / node helper) or a local MW hop (`:8790`/`:8791`/`:8792`) |

```
User / agent on Fog|EDGE host
        │
        ├─ Ollama SDK ──► 127.0.0.1:11434  (generate structured intent)
        │
        └─ HTTPS ───────► api-edge.calhegasmorais.pt/v1/wizard/*
                              (steps, prompts, validate, commit side-effects)
```

## Three wizard flows

1. **User account setup** — guided fields → structured JSON → auth/bootstrap endpoints (no secrets in Ollama prompts; secrets stay local / vault).
2. **Fog/EDGE request to join fog mesh** — node_id + join intent → mesh request against Fog health-check policy (`mesh_member` only after public `/health`).
3. **Register dependency edge nodes** — dependency list → `POST /v1/integrations` bodies (lab catalog; rejects secret fields).

## API surface (contract on api-edge)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/wizard` | Wizard index + local-Ollama policy |
| GET | `/v1/wizard/steps` | Ordered steps for all three flows |
| GET | `/v1/wizard/prompts/{flow}` | System+user prompt templates for local Ollama |
| POST | `/v1/wizard/parse` | Validate Ollama JSON output (Worker-side schema check only) |
| POST | `/v1/wizard/commit/{flow}` | Apply validated intent (account stub / mesh request / register deps) |

## Local SDK (executing host)

```bash
# Fog Mac / EDGE host
python3 ops/lib/ollama_local.py ping
python3 ops/lib/ollama_local.py wizard account --dry-run
python3 ops/lib/ollama_local.py wizard join-mesh --dry-run
python3 ops/lib/ollama_local.py wizard register-deps --dry-run
```

Env (optional):

- `OLLAMA_HOST` default `http://127.0.0.1:11434`
- `OLLAMA_MODEL` default first local tag (prefer small instruct)
- Never set a remote URL in desk automation

## Fail-open

| Layer | If local Ollama is down / waking / host_cap OVER |
|-------|--------------------------------------------------|
| **SDK** (`ops/lib/ollama_local.py`) | `ping` → `{ok:false}`; `wizard` returns template intent + `fail_open:true` (no crash) |
| **api-edge** `/v1/wizard/*` | Always up (contract only). `parse`/`commit` accept hand-authored JSON — never require Ollama |
| **TUI `?`** | Separate PLAN track — FAQ from public docs when generate is waking |

Never block account / join-mesh / register-deps on inference. Operator may fill fields manually and POST commit.

## metabol_pace


- Local Ollama = **host_cap** (RAM/GPU/CPU), not CF daily clock
- api-edge `/v1/wizard/*` rides **cf-worker-req** (pace HOLD/STASIS; auth never 503)
- Desk lane: `lane-hermes` / `lane-opencode` ALLOW under metabol

## Out of scope

- Fog TUI `?` wizard (PLAN only)
- Remote inference, HF Inference, Grok Bot as wizard engine
- workers.dev

## Related

- `docs/API-EDGE-MGMT.md`
- `docs/AGENT-EDGE-SDK.md`
- `docs/DESK-METABOL-TYPOLOGY.md`
- `ops/lib/ollama_local.py`
