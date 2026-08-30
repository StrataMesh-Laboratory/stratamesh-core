# StrataMesh Core — v0.4.0-lab

**Status:** SHIPPED · **ACB Academy** (Ollama ← Hugging Face, always-on)  
**Tag:** `v0.4.0-lab`  
**Baseline:** [v0.3.0](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.3.0) Fog Node kit

Lab. **Not mainnet.** Not a public offer of STRATA. `oracle_live=false`. `f_max=0` until n≥3.

## Why this is a major lab release

v0.3.0 made the Fog a product other operators can instantiate. v0.4.0-lab makes the **Orchestrator and AIOps ACBs trainable**:

1. **Always-on academy** at [academy.calhegasmorais.pt](https://academy.calhegasmorais.pt/) — catalog + fail-closed grader, no cron, no workers.dev.
2. **Corrective + exploratory formations** for all six students (Vespera / Kael / Nyx / Solace / Reed / Mira). Unready is fail-closed. Invented handlers do not pass.
3. **Ollama ← HF GGUF** on Fog residual capacity (`ollama pull hf.co/…`). Hugging Face stays a catalog of *means*. Inference Providers remain HOLD. Worker does not infer.
4. **STRATA cost model** declared (`GET /v1/cost`) and **lab-waived**. Later: subsistence debit of the student ACB — transfer, never mint.

## Not in this cut

- Paid training (oracle_live still false, fund unfunded)
- HF Inference Providers / Worker `HF_TOKEN` / AI Gateway
- grok@ as a student
- 6th Cloudflare cron
- Mainnet / MiCA public offer

## Run

```bash
curl -sS https://academy.calhegasmorais.pt/health
curl -sS https://academy.calhegasmorais.pt/v1/formations
cd src && python3 -m academy --list
```
