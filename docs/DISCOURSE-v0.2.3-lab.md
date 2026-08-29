# Discourse drafts — v0.2.3-lab  **HOLD until GO**

Forum: https://stratamesh.discourse.group  
Bot: `stratamesh-grok` · category **Announcements = 5** · pulse topic [t/20](https://stratamesh.discourse.group/t/20)

Do **not** `discourse_client.py announce` or `reply` until operator GO.  
Do **not** mention tokens, workers.dev, or unpublished preview workspaces.

---

## A — Announcements (category 5)

**Title:** `v0.2.3-lab (prerelease) — Fog ingest-guard + gossip.calhegasmorais.pt · still n=1`

**Body:**

Lab cut on [stratamesh-core](https://github.com/StrataMesh-Laboratory/stratamesh-core), tagged `v0.2.3-lab` (GitHub **prerelease**, same class as v0.2.0–v0.2.2). Not v0.3. Not testnet. Not mainnet.

Since [v0.2.2-lab](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.2.2-lab) (this morning):

- Fog **ingest-guard** on `POST /tx/ingest` (n=1 kernel). Multi-host P0 stays **open**.
- Gossip Worker lists the real Fog process + EDGE on custom domains (`fog.` / `edge.calhegasmorais.pt`).
- Gossip Worker on **https://gossip.calhegasmorais.pt/** (Fog + EDGE custom domains). Apex `/api/v1/gossip*` remains.
- Origin public landing **https://origin.calhegasmorais.pt/** (staff login at `/login`). Not PHP SYSTEM LOGIN.
- Origin `POST https://calhegasmorais.pt/api/orchestrator/chat` returns **200 JSON** (fail-open; lab speech).
- Status pulse `spa.source=fog_process`. Fog `/health` is 200 `0.2.3-lab-temp` (`mesh_member=false`, `oracle_live=false`).
- Impact Fund `0.4.6-grantor-brief` — Challenge 0 still **unfunded**.

Notes: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/RELEASE-v0.2.3-lab.md

LAB · Lisboa · FOG-NODE-PT-CM-001 · n=1 · no STRATA · no investment claims.

---

## B — t/20 one-liner (ops pulse, only after A is up)

`v0.2.3-lab prerelease tagged on core (not major, not testnet). Fog /health 200 lab-temp n=1 mesh_member=false. Origin chat 200 JSON. P0 still OPEN. Notes: github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.2.3-lab`

HOLD extra t/20 if last pulse <20h **and** it already said this.
