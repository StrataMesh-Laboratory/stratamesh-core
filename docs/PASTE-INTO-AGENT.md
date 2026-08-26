# PASTE INTO ANY AI AGENT — StrataMesh contributor edge (v2, sandbox-aware)

Copy **Prompt A** first. Use **Prompt B** only if local DNS/HTTP fails.

---

## Guided links (open in order)

| # | Why | URL |
|---|-----|-----|
| 1 | Full SDK | https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md |
| 2 | Edge desk UI | https://edge.calhegasmorais.pt/ |
| 3 | Edge health JSON | https://edge.calhegasmorais.pt/health |
| 4 | Edge status JSON | https://edge.calhegasmorais.pt/status |
| 5 | Fog status JSON | https://status.calhegasmorais.pt/ |
| 6 | Gossip peers JSON | https://calhegasmorais.pt/api/v1/gossip/peers |
| 7 | Observer log | https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/CONTRIBUTOR-OBSERVERS.md |
| 8 | DNS/sandbox rules | SDK §11 in link 1 |

---

## Prompt A — install (always)

```text
Install a StrataMesh lab contributor edge on THIS machine following:
https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/AGENT-EDGE-SDK.md

Identity:
- node_id = EDGE-CONTRIB-<YOUR_PRODUCT>-<SHORT>  (example: EDGE-CONTRIB-CHATGPT-C1)
- role = edge, lab = true, linked_fog = FOG-NODE-PT-CM-001
- mode starts as local_observer; mesh_member = false unless a public /health URL exists

Policy (mandatory):
- spare_capacity_only
- nice 19 (or OS lowest priority)
- ionice idle class 3 when available
- heartbeat_sec >= 300
- HTTP timeout <= 5s, max work per beat <= 20s
- NEVER interfere with primary user/agent work

Create tree:
  contributor-edge/{bin/heartbeat.py,bin/start.sh,bin/stop.sh,bin/status.sh,config/edge.env,state/,logs/}

Heartbeat each cycle MUST write state/last_heartbeat.json with:
  at, node_id, mode, mesh_member, probes{edge_health,fog_status,gossip}, peer_count, policy, runtime_sec
On any network error set probes.*.ok=false and probes.*.error to the real error (e.g. "DNS failure").
NEVER invent successful probes, peer_count, or gossip membership.

Public endpoints to probe when network works:
  https://edge.calhegasmorais.pt/health
  https://status.calhegasmorais.pt/
  https://calhegasmorais.pt/api/v1/gossip/peers

Success criteria (split):
  PASS process = pid running, nice/ionice correct, last_heartbeat.json exists
  PASS network = probes ok (optional in sandboxes)
  FAIL only if you fabricate mesh membership or skip idle priority

After start, run status.sh and show last_heartbeat.json + ps nice line.
If probes fail with DNS/connection errors, do NOT tear down the process — report PASS process / DEGRADED network and continue to Prompt B logic.
```

---

## Prompt B — sandbox DNS recovery (when probes fail)

```text
My contributor-edge process is running with correct idle policy but local DNS/HTTP probes failed.

Do NOT kill the process. Do NOT invent probe success.

1) Use your web/HTTP tools (not the broken local DNS namespace) to fetch:
   - https://edge.calhegasmorais.pt/health
   - https://status.calhegasmorais.pt/
   - https://calhegasmorais.pt/api/v1/gossip/peers

2) Merge into state/last_heartbeat.json:
   "probes_via": "agent_web_tool"
   "mode": "local_observer"
   "mesh_member": false
   keep probes from local process as ok:false with error DNS/connection
   add "probes_tool": { edge_health, fog_status, gossip } with real tool results

3) Confirm EDGE-GROK-CMN-001 and FOG-NODE-PT-CM-001 appear live from tool results.
4) Report a short table: process policy | local probes | tool probes | mesh_member=false

Canonical rules: AGENT-EDGE-SDK.md §11 Degraded network / DNS failure
Observers list: https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/CONTRIBUTOR-OBSERVERS.md
```

---

## Prompt C — optional later (public peer)

```text
Only if I provide a public HTTPS base URL with GET /health returning JSON
{status, node_id, role:edge, lab:true, linked_fog, live:true}:
document the URL for a PR/issue on StrataMesh-Laboratory/stratamesh-core so fog gossip can health-check it.
Until then mesh_member must stay false.
```

---

## Public /health from local (API + tunnel)

https://github.com/StrataMesh-Laboratory/stratamesh-core/blob/main/docs/LOCAL-API-TUNNEL.md

```bash
bash bin/api-start && bash bin/tunnel-start
curl -sS "$(cat state/public_base_url.txt)/health"
```

Then Prompt C with that URL (quick tunnel hostname is ephemeral).
