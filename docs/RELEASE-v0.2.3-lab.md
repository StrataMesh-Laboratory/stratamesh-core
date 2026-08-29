# StrataMesh Core — v0.2.3-lab

**Status:** DRAFT · **HOLD** until operator GO  
**Proposed tag:** `v0.2.3-lab` (GitHub **prerelease**, same class as v0.2.0–v0.2.2)  
**Baseline:** [v0.2.2-lab](https://github.com/StrataMesh-Laboratory/stratamesh-core/releases/tag/v0.2.2-lab) (`c3ab1557`)  
**Proposed HEAD:** `a7ac55e4` (2026-08-29T21:34Z) · 21 commits · 80 files  

This is **not** a semver major, **not** v0.3, **not** testnet, **not** mainnet.

## Why a lab cut (justified)

v0.2.2-lab explicitly deferred:

- Worker gossip pointed at the real Fog process (#16)
- On-graph metabolism for STRATA spend (#36)

Both landed. Plus the Fog **0.2.3 ingest-guard** (#48) already logged as `v0.2.3-lab-wip` in `CHANGELOG-LAB.md`.

That is a **patch-class lab prerelease** (`0.2.2` → `0.2.3`), same ladder as the last three tags.

## Why it is not a “major” release (not justified)

| Claim | Reality |
|---|---|
| 1.0.0 / public testnet / mainnet | Control law still **LAB**. Roadmap v0.3 is promotion law, not this cut. |
| P0 closed | P0 `260826-001576` **OPEN**. Ingest-guard is n=1 kernel only. |
| Mesh / oracle live | `n=1` `mesh_member=false` `oracle_live=false` |
| Live Fog *is* this git tree | Public Fog is still `0.2.3-lab-temp` on the agent host. Git `node_persistent.py` version string is still `0.2.2-dev` until GO bump. |
| Agora settlements / BFT | `agora.settlements={unavailable:"n<2"}` · `f_max=0` |

Size (80 files) is mostly **Worker snapshots + origin chat fail-open**, not a protocol break.

## Added since v0.2.2-lab (protocol / Fog)

- Fog process-gossip **ingest-guard** (#48): `POST /tx/ingest` syntax 400 / semantic `accepted=false`. Does **not** close multi-host P0. `src/p0_ingest_guard.py` + `src/test_p0_ingest.py`
- GET `/spa` honesty envelope in git (`spa_view`: `source=fog_process`, `mesh_member=false`, agora unavailable n<2)
- GET `/gossip` self-peer only (`lab_single_host_gossip`)
- Optional on-graph metabolism (#36) — lab spend path; not a mint
- Metabolism v1.3 circuit wired into live remaining/hour_spent callers (#47) + Hypothesis properties (#49)

## Added since v0.2.2-lab (origin / Workers — custom domain only)

- Origin `POST /api/orchestrator/chat` → 200 JSON (`origin-orch-chat-1.1.0` AbortSignal 1500ms; orch `10.24.4-chat-budget`)
- Gossip `2.3.4-custom-domain`: peers Fog + EDGE on `fog.calhegasmorais.pt` / `edge.calhegasmorais.pt` (never workers.dev)
- Status pulse `spa.source=fog_process` (Fog `/health` 200, not 530)
- Impact Fund live `0.4.6-grantor-brief` (canonical repo `stratamesh-impact-fund`)
- Unpublished live Workers snapshotted into git (fund, edge-api, sca-ml, scout, …)

## Explicitly not in this cut

- Multi-host P0 close
- Replacing live `0.2.3-lab-temp` with git `node_persistent.py` (needs process restart on the Fog host)
- KV HANDOFF write (Cloudflare free KV quota 10048 until 00:00 UTC 2026-08-30)
- Inner orch `/chat` real LLM reply (still 900ms budget fallback)
- grok90, 6th cron, workers.dev, GitHub `/actions` burn, Renovate merge

## GO checklist (do not run until operator says GO)

1. Bump `src/node_persistent.py` status `version` `0.2.2-dev` → `0.2.3-lab`
2. Point README release badge `v0.2.2-lab` → `v0.2.3-lab`
3. Flip this file + `CHANGELOG-LAB.md` from DRAFT/WIP → dated cut
4. Git tag `v0.2.3-lab` on the agreed SHA (prerelease)
5. GitHub Release (prerelease=true) with this notes body
6. Discourse **Announcements (5)** + one-line pointer on [t/20](https://stratamesh.discourse.group/t/20) — body in `docs/DISCOURSE-v0.2.3-lab.md`

LAB only. No STRATA, no investment claims, no mainnet.
