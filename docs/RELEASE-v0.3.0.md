# StrataMesh Core — v0.3.0

**Status:** SHIPPED · **Fog Node instantiation** (StrataMesh LAB)  
**Tag:** `v0.3.0`  
**Baseline:** [v0.2.3-dev](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.2.3-dev)

Lab. **Not mainnet.** Not a public offer of STRATA. `oracle_live=false`. `f_max=0` until n≥3.

This is the first cut that treats a Fog Node as a **product other operators can instantiate**: hardware wizard, destyle TUI, workerd hop, operator 2FA. No secrets in git.

## Why this is a major lab release

Until now the Fog lived as the Calhegas Morais reference process. v0.3.0 abstracts that into a kit:

1. **Identity** — registered `node_id` + 2FA to the operator email (DeoMail via `POST /api/auth/fog/bootstrap/*`).
2. **Keys stay local** — GitHub PAT and Cloudflare tokens optional, `0600` under `~/.config/stratamesh`. Account id is discovered from the Cloudflare API, never hardcoded.
3. **Shared OS** — clone [stratamesh-core](https://github.com/StrataMesh-Laboratory/stratamesh-core), run the wizard, contribute **resources → PoC → STRATA** (`#mint` / `#0`).
4. **Honest mesh** — a new node starts **n=1** `mesh_member=false`. The reference CMN Fog remains n=2 (Mac + EDGE session).

Kit: [`deploy/fog-node/README.md`](../deploy/fog-node/README.md) · macOS: [`deploy/mac-fog/`](../deploy/mac-fog/)

## Not in this cut

- Byzantine `f_max>0` (needs n≥3)
- Automatic public testnet join
- Linux first-class installer (session Fog on `:8080` still exists)
- Mainnet / MiCA public offer
- workers.dev

## Run (macOS)

```bash
git clone https://github.com/StrataMesh-Laboratory/stratamesh-core.git
cd stratamesh-core
python3 deploy/mac-fog/fog-bootstrap.py
```

Request a node id on [Discourse](https://stratamesh.discourse.group) first if you are not already in the registry.
