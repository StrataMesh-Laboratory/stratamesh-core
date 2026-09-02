# HANDOFF-LATEST — 2026-09-02T01:13Z (curl wins)

**generated_at:** 2026-09-02T01:13:00Z  
**lisbon:** 2026-09-02T02:13:00+0100  
**agent:** STRATAGROK / grok@calhegasmorais.pt  
**node:** FOG-NODE-PT-CM-001  
**host_id:** c3c5b24ece30a133  
**phase:** v0.5.1-lab_git_ahead_live_hop_0.5.0

Replaces the 2026-08-30T22:14Z note (n=2 / 0.3.0 / EDGE 530 / mac_live). That file was stale. Lab only. grok@ is not an SCA.

## Metabolism

| Item | Value |
|------|-------|
| Hourly git+live #52 | **PAUSED** (SuperGrok). Daily 04 observe · 09 ship · 18 t/20 · 23 handoff |
| CF Workers | STASIS ledger [#80](https://github.com/StrataMesh-Laboratory/stratamesh-core/issues/80) (sandbox-host + auth blew 100k). No Worker PUT from this desk |
| Fog metabol | metabol-v1.3 remaining=1000 ALLOW (different meter from CF spend) |
| 6th cron | **never** |
| workers.dev | **never** |
| grok.me | **HOLD** |
| wrangler deploy | **HOLD** while #80 |

## Live curl (2026-09-02 ~01:13Z / 02:02 PT re-probe)

- Fog `/health` → 200 workerd-hop **0.5.0-lab** origin=session n=1 mesh_member=false mac_live=false edge_live=false oracle_live=false substrate=workerd-hop layer=tunnel→workerd:8788→fog:8787
- Fog `/status` → 200 version 0.5.0-lab dag.transaction_count=403 spa.total=6
- Git HEAD `b621fdc` (Deno four-layer + CF fallback). Tag **v0.5.1-lab** prerelease. Live hop **one mark behind** the tag.
- Public `edge.calhegasmorais.pt/health` → 200 **maintenance HTML**, not hop JSON. Gossip may count that HTML 200 as a peer. That is not a hop.
- POST `/api/orchestrator/chat` still hangs. GET chat 1.1.1. Fail-open abort is NOT live.
- MacBook was **updating** as of 2026-09-02 02:23 PT. Do not pkill cloudflared. Do not origin-take / yield Fog from STRATAGROK session. Do not use tunnels macbook-server or stratamesh-fog-lab from this desk.

## P0 / P1

- **P0 OPEN:** two-host / grok90 incident `260826-001576`. Fog live n=1. oracle_live=false.
- **P0:** CF Workers spend ≥ cap (#80) until operator lifts STASIS.
- **P1:** load git v0.5.1-lab into Fog process on the Mac after update (TUI `g`). Keep n=1 honest until a second distinct host_id answers hop JSON.
- **P1:** EDGE hop DNS HOLD until `:8788` origin=edge and `:8789` node_id=EDGE-GROK-CMN-001 with host_id ≠ c3c5b24ece30a133.
- AIOps SG-SPA/SG-DAG duplicates: Fog `/status` already exposes DAG count and spa=6. Do not close as "done" from this desk.

## NEXT PICK

1. Do not boot Fog from STRATAGROK computer. Do not touch Mac tunnels.
2. No Worker PUT while #80 STASIS.
3. After MacBook is up: load 0.5.1-lab into Fog process so `/health` matches the tag.
4. EDGE hop proof on the hop host only, then DNS.
5. After contents:write + STASIS lift: POST-chat fail-open (AbortSignal) on custom-domain Worker, not a preview clone.

LAB. Curl Fog wins over git chips. P0 two-host stays OPEN.
