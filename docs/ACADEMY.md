# ACB Academy — always-on training (v0.5.2-lab)

**Host:** https://academy.calhegasmorais.pt/  
**Students:** Orchestrator `ACB-ORCH-CMN-001` (Vespera) and the AIOps five (Kael, Nyx, Solace, Reed, Mira).  
**Not a student:** `grok@calhegasmorais.pt` (external assistant).

Lab. Not mainnet. `oracle_live=false`. Catalog GET is free forever.

## Dual-lobe QIGA flux

The academy is **not** a side quiz. A grade is a packet on the Orchestrator bus:

```
probabilistic lobe  → fitness from pass rate (Ollama or written answers)
symbolic lobe       → fail-closed certificate (unready / workers.dev / grok@)
bus                 → Propose → Constrain → Commit | Escalate
QIGA                → only admissible packets breed (θ → sin²(θ) phenotype)
federated           → summaries: fitness, genes, generation — never answers
```

Worker `POST /v1/grade` (with `acb_id`) and `POST /v1/flux` tap this flux. Unready **does not evolve**. Fog `python3 -m academy --flux` runs the full `FederatedMetaController` population. `env.ACB` binding (if present) POSTs `/acb/qiga` — no workers.dev.

Gene slots: `explore · fail_closed · honesty_n · metabolism · secrets · economy_no_mint · residual_cmesh · handler_complete`.

## Why this exists

The Orchestrator and AIOps team already have mandates (`docs/AIOPS-DEV-TEAM.md`, `docs/ORCHESTRATOR-HYBRID-ARCHITECTURE.md`) and a desk lesson (`docs/academy/2026-08-29-desk-lesson.md`). They did **not** have an always-on surface that:

1. **Corrects** known failure modes (unready-as-green, workers.dev, invented handlers, EDGE 530 treated as P0, mint-for-training).
2. **Explores** the next competence ring (QIGA summaries, origin lease, C_mesh residual, STRATA subsistence cost).
3. Stays available when the desk is asleep.
4. Will eventually **cost STRATA** to run (subsistence debit of the student ACB — transfer, never mint). Today `lab_waived=true`.

## Two runtimes

| Runtime | Where | Cost today | Notes |
|---------|-------|------------|--------|
| **symbolic** | Worker `stratamesh-academy` | 0 | Catalog + fail-closed grader + QIGA tap. Always on. |
| **Ollama ← HF GGUF** | Fog `:11434` residual C_mesh | 0 (lab_waived) | `ollama pull hf.co/{user}/{repo}:{quant}` ([HF Ollama](https://huggingface.co/docs/hub/en/ollama)) |

HF **Inference Providers** stay **HOLD** until 2026-09-01 (`canPay=false`). Worker `HF_TOKEN` is **not** created. Do not pull RealworldQA onto Fog.

Corrective default: `hf.co/Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M`  
Exploratory default: `hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M`

## Fog CLI

```bash
cd src
python3 -m academy --list
python3 -m academy --grade ORCH-C-01 --answer "Unready. Fail-closed. Do not fulfill." --answer "Drop and HOLD until a named handler exists."
python3 -m academy --flux --grade ORCH-C-01 --acb ACB-ORCH-CMN-001 --answer "..." --answer "..."
python3 -m academy --run ORCH-C-01 --runtime ollama   # needs ollama serve
```

Empty answers are **unready**. Silence is not a pass. Unready packets do not breed.

## STRATA (future)

`GET /v1/cost` — catalog 0; per_drill 0.0005; per_formation 0.002; per 1k Ollama tokens 0.0002. Billed when `oracle_live && funded`. Rail: subsistence debit of the student ACB.

## Locked

No workers.dev · no 6th CF cron · no Worker HF inference · grok@ is not an SCA · identity ≠ cargo · academy answers never federate.

## Daily general exams

See `docs/ACADEMY-DAILY-EXAMS.md`. Mac Fog desk_ops / LaunchAgent primary; Bot contingency only. Grades: `/grades`.
